// app.js — Main Vue application for LoreChat

const { createApp, ref, computed, onMounted, nextTick, watch } = Vue;

const BOT_EMOJIS = ['👨', '👩', '👧', '👦', '👶', '🧑', '👨‍🦱', '👩‍🦱', '👨‍🦰', '👩‍🦰', '👱‍♂️', '👱‍♀️', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲', '🧔', '👵', '👴', '👲', '👳‍♂️', '👳‍♀️', '🧕', '👮‍♂️', '👮‍♀️', '👷‍♂️', '👷‍♀️', '💂‍♂️', '💂‍♀️', '🕵️‍♂️', '🕵️‍♀️', '👨‍⚕️', '👩‍⚕️', '👨‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '👨‍🎓', '👩‍🎓', '👨‍🎤', '👩‍🎤', '👨‍🏫', '👩‍🏫', '👨‍🏭', '👩‍🏭', '👨‍💻', '👩‍💻', '👨‍💼', '👩‍💼', '👨‍🔧', '👩‍🔧', '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🚒', '👩‍🚒', '👨‍✈️', '👩‍✈️', '👨‍🚀', '👩‍🚀', '👨‍⚖️', '👩‍⚖️', '👰', '🤵', '👸', '🤴', '🤶', '🎅', '🧙‍♂️', '🧙‍♀️', '🧝‍♂️', '🧝‍♀️', '🧛‍♂️', '🧛‍♀️', '🧟‍♂️', '🧟‍♀️', '🧞‍♂️', '🧞‍♀️', '🧜‍♂️', '🧜‍♀️', '🧚‍♂️', '🧚‍♀️', '💃', '🕺', '🥷', '🦸', '🦹', '🏇', '⛷️', '🏂', '🏄', '🚣', '🏊', '🏋️', '🚴', '⛹️', '🦁', '🐺', '🐉', '🦉', '🦄', '🐼', '💎', '⚔️', '🛡️', '🧪', '📜', '🔮', '🦾'];

const BOT_COLORS = [
  '#ff0000', '#ff4500', '#ff7043', '#ff6d00', '#f39c12', '#faa61a',
  '#fee75c', '#ffeb3b', '#c8e600', '#57f287', '#2ecc71', '#1abc9c',
  '#00e5ff', '#00b0f4', '#3498db', '#5865f2', '#7289da', '#9b59b6',
  '#aa00ff', '#eb459e', '#ff4081', '#ff73fa', '#ed4245', '#e74c3c'
];

createApp({
  setup() {
    // ===== STATE =====
    const view = ref('home');
    const viewHistory = ref([]);
    const homeTab = ref('chats');
    const modal = ref(null);
    const settingsSaved = ref(false);
    const errorMsg = ref('');
    const isLoading = ref(false);
    const isGeneratingImage = ref(false);
    const directorMode = ref(false);
    const chatMenu = ref(false);
    const summaryModalOpen = ref(false);
    const canNavUp = ref(false);
    const canNavDown = ref(false);
    const editingSegKey = ref(null);
    const editSegText = ref('');
    const editSegType = ref('narrate');
    const isTouchDevice = ref(false);
    const tappedSegKey = ref(null);
    // Data
    const bots = ref([]);
    const chats = ref([]);
    const adventures = ref([]);
    const stories = ref([]);
    const settings = ref({ apiKey: '', model: 'openai', memoryDepth: 20, storyChunkSize: 'medium' });

    // Active session
    const activeSession = ref(null);
    const activeMessages = ref([]);
    const storyChunks = ref([]);

    // Input
    const inputText = ref('');
    const mentionedBot = ref(null);
    const mentionSuggestions = ref([]);

    // New session form
    const newSession = ref({ name: '', scenario: '', botIds: [], characterName: '', characterProfile: '' });

    // Bot editing
    const editingBot = ref({ name: '', persona: '', color: BOT_COLORS[0] });

    // Refs
    const messagesArea = ref(null);
    const storyBody = ref(null);
    const chatInput = ref(null);
    const importFile = ref(null);
    const kebabMenuRef = ref(null);

    // ===== ICON HELPER =====
    function svg(name, className = '') {
      return getIcon(name, className);
    }

    // ===== COMPUTED =====
    const activeBots = computed(() => {
      if (!activeSession.value) return [];
      return bots.value.filter(b => activeSession.value.botIds.includes(b.id));
    });

    const botColors = computed(() => BOT_COLORS);

    const kebabClearLabel = computed(() => {
      if (view.value === 'adventure') return 'Clear Adventure';
      if (view.value === 'story') return 'Clear Story';
      return 'Clear Chat';
    });

    const kebabDeleteLabel = computed(() => {
      if (view.value === 'adventure') return 'Delete Adventure';
      if (view.value === 'story') return 'Delete Story';
      return 'Delete Chat';
    });

    // Unified input placeholder
    const inputPlaceholder = computed(() => {
      if (view.value === 'chat') return 'Message...';
      if (view.value === 'adventure') {
        return directorMode.value ? 'Direct the story...' : 'What do you do?';
      }
      if (view.value === 'story') {
        if (storyChunks.value.length === 0) return 'Begin Story →';
        if (directorMode.value) return 'Direct the story...';
        return 'Continue Story →';
      }
      return '';
    });

    // Unified input disabled state
    const inputDisabled = computed(() => {
      if (view.value === 'story') {
        // In story mode, input is disabled unless director mode is on
        return !directorMode.value;
      }
      return false;
    });

    function kebabDelete() {
      if (view.value === 'chat') { deleteChat(activeSession.value.id); goBack(); }
      else if (view.value === 'adventure') { deleteAdventure(activeSession.value.id); goBack(); }
      else if (view.value === 'story') { deleteStory(activeSession.value.id); goBack(); }
    }

    // ===== PROSE PARSER =====
    function parseProseSegments(text) {
      if (typeof text === 'object' && text !== null) {
        if (text.content) { text = text.content; }
        else { return [{ type: 'plain', text: '', raw: '' }]; }
      }
      if (!text || typeof text !== 'string') return [];
      text = text.replace(/([a-zA-Z])(NN|AA|TT|DD)/g, '$1 $2');
      text = text.replace(/(NN|AA|TT|DD)([a-zA-Z])/g, '$1 $2');
      const tagMap = { 'NN': 'narrate', 'AA': 'action', 'TT': 'thought', 'DD': 'dialogue' };
      const segments = [];
      const tagPattern = /\b(NN|AA|TT|DD)\s/g;
      const matches = [];
      let match;
      while ((match = tagPattern.exec(text)) !== null) {
        matches.push({ tag: match[1], index: match.index });
      }
      if (matches.length === 0) {
        return [{ type: 'plain', text: text.trim(), raw: text.trim() }];
      }
      for (let i = 0; i < matches.length; i++) {
        const current = matches[i];
        const next = matches[i + 1];
        const startPos = current.index + current.tag.length + 1;
        const endPos = next ? next.index : text.length;
        let content = text.substring(startPos, endPos).trim();
        content = content.replace(/^["'""]|["'""]$/g, '');
        if (content) {
          const rawText = text.substring(current.index, endPos).trim();
          segments.push({ type: tagMap[current.tag], text: content, raw: rawText });
        }
      }
      return segments.length > 0 ? segments : [{ type: 'plain', text, raw: text }];
    }

    function getAdventureRenderUnits(msg) {
      const segments = parseProseSegments(msg.content);
      return segments
        .filter(seg => seg.text.trim())
        .map(seg => ({
          type: seg.type === 'plain' ? 'narrate' : seg.type,
          text: seg.text,
          isDialogue: seg.type === 'dialogue'
        }));
    }

    // ===== HELPERS =====
    function getBotColor(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.color : '#5865f2';
    }

    function getBotInitial(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.name[0].toUpperCase() : '?';
    }

    function getBotEmoji(botId) {
      const bot = bots.value.find(b => b.id === botId);
      return bot ? bot.emoji || '' : '';
    }

    function getImageUrl(prompt, seed) {
      const encoded = encodeURIComponent(prompt);
      const key = settings.value.apiKey ? `&key=${settings.value.apiKey}` : '';
      const seedParam = seed != null ? `&seed=${seed}` : '';
      return `https://gen.pollinations.ai/image/${encoded}?model=zimage&width=768&height=1152&private=true${seedParam}${key}`;
    }

    function formatTime(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      const now = new Date();
      const diffDays = Math.floor((now - d) / 86400000);
      if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    function showError(msg) {
      errorMsg.value = msg;
      setTimeout(() => { errorMsg.value = ''; }, 3500);
    }

    function toPlain(obj) {
      return JSON.parse(JSON.stringify(obj));
    }

    function scrollToBottom(ref) {
      nextTick(() => {
        if (ref.value) ref.value.scrollTop = ref.value.scrollHeight;
      });
    }

    function updateChunkNavState() {
      nextTick(() => {
        const container = storyBody.value;
        if (!container) return;
        const dividers = container.querySelectorAll('.story-chunk-divider');
        if (dividers.length === 0) { canNavUp.value = false; canNavDown.value = false; return; }
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        const threshold = 60;
        canNavUp.value = Array.from(dividers).some(d => d.offsetTop < scrollTop + threshold);
        canNavDown.value = Array.from(dividers).some(d => d.offsetTop > scrollTop + containerHeight - threshold);
      });
    }

    function scrollToChunkDivider(direction) {
      const container = storyBody.value;
      if (!container) return;
      const dividers = Array.from(container.querySelectorAll('.story-chunk-divider'));
      if (dividers.length === 0) return;
      const scrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const threshold = 60;
      if (direction === 'up') {
        const targets = dividers.filter(d => d.offsetTop < scrollTop + threshold - 10);
        if (targets.length === 0) return;
        const target = targets[targets.length - 1];
        container.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
      } else {
        const target = dividers.find(d => d.offsetTop > scrollTop + containerHeight - threshold + 10);
        if (!target) return;
        container.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
      }
      setTimeout(updateChunkNavState, 400);
    }

    // ===== NAVIGATION =====
    function navigate(target) {
      viewHistory.value.push(view.value);
      view.value = target;
    }

    function goBack() {
      view.value = viewHistory.value.pop() || 'home';
      activeSession.value = null;
      activeMessages.value = [];
      storyChunks.value = [];
      inputText.value = '';
      directorMode.value = false;
      editingSegKey.value = null;
      editSegText.value = '';
      tappedSegKey.value = null;
    }

    // ===== SETTINGS =====
    async function loadSettings() {
      const s = await DB.getOne('settings', 'main');
      if (s) settings.value = { ...settings.value, ...s };
    }

    async function saveSettings() {
      await DB.putOne('settings', { id: 'main', ...settings.value });
      settingsSaved.value = true;
      setTimeout(() => { settingsSaved.value = false; }, 2000);
    }

    watch(settings, async () => {
      await DB.putOne('settings', { id: 'main', ...settings.value });
      settingsSaved.value = true;
      setTimeout(() => { settingsSaved.value = false; }, 1500);
    }, { deep: true });

    // ===== LOAD DATA =====
    async function loadAll() {
      bots.value = (await DB.getAll('bots')).sort((a, b) => (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0));
      chats.value = (await DB.getAll('chats')).sort((a, b) => b.updatedAt - a.updatedAt);
      adventures.value = (await DB.getAll('adventures')).sort((a, b) => b.updatedAt - a.updatedAt);
      stories.value = (await DB.getAll('stories')).sort((a, b) => b.updatedAt - a.updatedAt);
      await loadSettings();
    }

    // ===== BOTS =====
    function openBotModal(bot) {
      editingBot.value = bot ? { ...bot } : { id: null, name: '', persona: '', color: BOT_COLORS[0], emoji: '' };
      modal.value = 'bot';
    }

    function editBot(bot) { openBotModal(bot); }

    async function saveBot() {
      const bot = {
        ...editingBot.value,
        id: editingBot.value.id || DB.generateId(),
        createdAt: editingBot.value.createdAt || Date.now()
      };
      await DB.putOne('bots', bot);
      await loadAll();
      modal.value = null;
    }

    function deleteBotFromModal() {
      if (!editingBot.value?.id) return;
      deleteBot(editingBot.value.id);
      modal.value = null;
    }

    async function deleteBot(id) {
      if (!confirm('Delete this bot?')) return;
      await DB.deleteOne('bots', id);
      await loadAll();
    }

    async function exportBots() {
      const data = { bots: bots.value };
      downloadJSON(data, 'lorechat-bots.json');
    }

    // ===== CREATE SESSION =====
    function openCreateModal() {
      const youBot = bots.value.find(b => b.isYou);
      const preSelected = (homeTab.value === 'adventure' && youBot) ? [youBot.id] : [];
      newSession.value = { name: '', scenario: '', botIds: preSelected, characterName: '', characterProfile: '' };
      modal.value = 'create';
    }

    function toggleBotSelection(botId) {
      const idx = newSession.value.botIds.indexOf(botId);
      if (idx >= 0) newSession.value.botIds.splice(idx, 1);
      else newSession.value.botIds.push(botId);
    }

    async function createSession() {
      const ns = newSession.value;
      if (ns.botIds.length === 0) return;

      let sessionName = ns.name.trim();
      if (homeTab.value === 'chats' && !sessionName) {
        const selectedBots = bots.value.filter(b => ns.botIds.includes(b.id));
        if (selectedBots.length <= 2) {
          sessionName = selectedBots.map(b => b.name).join(', ');
        } else {
          sessionName = selectedBots.slice(0, 2).map(b => b.name).join(', ') + `, +${selectedBots.length - 2} more`;
        }
      }

      if ((homeTab.value === 'adventure' || homeTab.value === 'stories') && !sessionName) return;

      const id = DB.generateId();
      const now = Date.now();

      if (homeTab.value === 'chats') {
        const session = { id, name: sessionName, botIds: [...ns.botIds], messages: [], lastMessage: '', createdAt: now, updatedAt: now };
        await DB.putOne('chats', session);
        await loadAll();
        modal.value = null;
        openChat(session);
      } else if (homeTab.value === 'adventure') {
        const youBot = bots.value.find(b => b.isYou);
        const session = { id, name: sessionName, scenario: ns.scenario, characterName: youBot?.name || 'You', characterProfile: youBot?.persona || '', botIds: [...ns.botIds], messages: [], createdAt: now, updatedAt: now };
        await DB.putOne('adventures', session);
        await loadAll();
        modal.value = null;
        openAdventure(session);
      } else if (homeTab.value === 'stories') {
        const session = { id, name: sessionName, scenario: ns.scenario, botIds: [...ns.botIds], chunks: [], createdAt: now, updatedAt: now };
        await DB.putOne('stories', session);
        await loadAll();
        modal.value = null;
        openStory(session);
      }
    }

    // ===== CHAT =====
    function openChat(chat) {
      activeSession.value = chat;
      activeMessages.value = chat.messages || [];
      directorMode.value = false;
      navigate('chat');
      scrollToBottom(messagesArea);
    }

    async function clearSession() {
      if (!confirm('Clear all messages?')) return;
      activeMessages.value = [];
      storyChunks.value = [];
      activeSession.value.messages = [];
      activeSession.value.chunks = [];
      activeSession.value.lastMessage = '';
      if (view.value === 'story') activeSession.value.summary = '';
      activeSession.value.updatedAt = Date.now();
      if (view.value === 'chat') await DB.putOne('chats', toPlain(activeSession.value));
      if (view.value === 'adventure') await DB.putOne('adventures', toPlain(activeSession.value));
      if (view.value === 'story') await DB.putOne('stories', toPlain(activeSession.value));
      await loadAll();
    }

    // @mention detection
    function onInput() {
      const val = inputText.value;
      const atIdx = val.lastIndexOf('@');
      if (atIdx >= 0) {
        const query = val.substring(atIdx + 1).toLowerCase();
        mentionSuggestions.value = activeBots.value.filter(b => b.name.toLowerCase().startsWith(query));
      } else {
        mentionSuggestions.value = [];
        mentionedBot.value = null;
      }
    }

    function insertAt() {
      if (!inputText.value.includes('@')) {
        inputText.value = '@' + inputText.value;
        onInput();
      }
      nextTick(() => chatInput.value?.focus());
    }

    function selectMention(bot) {
      const atIdx = inputText.value.lastIndexOf('@');
      inputText.value = inputText.value.substring(0, atIdx) + '@' + bot.name + ' ';
      mentionedBot.value = bot;
      mentionSuggestions.value = [];
      chatInput.value?.focus();
    }

    // ===== UNIFIED SEND HANDLER =====
    async function redoImage(imageId) {
      if (isGeneratingImage.value) return;
      isGeneratingImage.value = true;

      try {
        let imageEntry, prompt;

        if (view.value === 'adventure') {
          const idx = activeMessages.value.findIndex(m => m.id === imageId);
          if (idx < 0) return;
          imageEntry = activeMessages.value[idx];
          prompt = imageEntry.imagePrompt;
          activeMessages.value[idx] = { ...activeMessages.value[idx], imageUrl: null };
        } else if (view.value === 'story') {
          const idx = storyChunks.value.findIndex(c => c.ts === imageId && c.type === 'image');
          if (idx < 0) return;
          imageEntry = storyChunks.value[idx];
          prompt = imageEntry.prompt;
          storyChunks.value[idx] = { ...storyChunks.value[idx], imageUrl: null };
        }

        const imageUrl = getImageUrl(prompt, Math.floor(Math.random() * 2147483647));

        const img = new Image();
        img.onload = async () => {
          if (view.value === 'adventure') {
            const idx = activeMessages.value.findIndex(m => m.id === imageId);
            if (idx >= 0) {
              activeMessages.value[idx] = { ...activeMessages.value[idx], imageUrl };
            }
            activeSession.value.messages = [...activeMessages.value];
            await DB.putOne('adventures', toPlain(activeSession.value));
          } else if (view.value === 'story') {
            const idx = storyChunks.value.findIndex(c => c.ts === imageId && c.type === 'image');
            if (idx >= 0) {
              storyChunks.value[idx] = { ...storyChunks.value[idx], imageUrl };
            }
            activeSession.value.chunks = [...storyChunks.value];
            await DB.putOne('stories', toPlain(activeSession.value));
          }
          await loadAll();
        };
        img.src = imageUrl;
      } catch (err) {
        showError('Image regeneration error: ' + err.message);
      }
      isGeneratingImage.value = false;
    }

    async function reimagineImage(imageId) {
      if (isGeneratingImage.value) return;
      isGeneratingImage.value = true;

      try {
        let imageIdx;

        if (view.value === 'adventure') {
          imageIdx = activeMessages.value.findIndex(m => m.id === imageId);
          if (imageIdx < 0) return;
          activeMessages.value[imageIdx] = { ...activeMessages.value[imageIdx], imageUrl: null };
        } else if (view.value === 'story') {
          imageIdx = storyChunks.value.findIndex(c => c.ts === imageId && c.type === 'image');
          if (imageIdx < 0) return;
          storyChunks.value[imageIdx] = { ...storyChunks.value[imageIdx], imageUrl: null };
        }

        const newPrompt = await AI.generateImagePrompt(
          activeBots.value,
          activeSession.value.scenario,
          activeSession.value.summary || null,
          settings.value
        );

        if (view.value === 'adventure') {
          activeMessages.value[imageIdx] = { ...activeMessages.value[imageIdx], imagePrompt: newPrompt };
        } else if (view.value === 'story') {
          storyChunks.value[imageIdx] = { ...storyChunks.value[imageIdx], prompt: newPrompt };
        }

        const imageUrl = getImageUrl(newPrompt, Math.floor(Math.random() * 2147483647));

        const img = new Image();
        img.onload = async () => {
          if (view.value === 'adventure') {
            const idx = activeMessages.value.findIndex(m => m.id === imageId);
            if (idx >= 0) {
              activeMessages.value[idx] = { ...activeMessages.value[idx], imageUrl };
            }
            activeSession.value.messages = [...activeMessages.value];
            await DB.putOne('adventures', toPlain(activeSession.value));
          } else if (view.value === 'story') {
            const idx = storyChunks.value.findIndex(c => c.ts === imageId && c.type === 'image');
            if (idx >= 0) {
              storyChunks.value[idx] = { ...storyChunks.value[idx], imageUrl };
            }
            activeSession.value.chunks = [...storyChunks.value];
            await DB.putOne('stories', toPlain(activeSession.value));
          }
          await loadAll();
        };
        img.src = imageUrl;
      } catch (err) {
        showError('Image reimagine error: ' + err.message);
      }
      isGeneratingImage.value = false;
    }

    async function removeImage(imageId) {
      if (view.value === 'adventure') {
        const idx = activeMessages.value.findIndex(m => m.id === imageId);
        if (idx >= 0) {
          activeMessages.value.splice(idx, 1);
          activeSession.value.messages = [...activeMessages.value];
          await DB.putOne('adventures', toPlain(activeSession.value));
          await loadAll();
        }
      } else if (view.value === 'story') {
        const idx = storyChunks.value.findIndex(c => c.ts === imageId && c.type === 'image');
        if (idx >= 0) {
          storyChunks.value.splice(idx, 1);
          activeSession.value.chunks = [...storyChunks.value];
          await DB.putOne('stories', toPlain(activeSession.value));
          await loadAll();
        }
      }
    }

    async function handleImageGenerate() {
      if (isGeneratingImage.value || isLoading.value) return;
      isGeneratingImage.value = true;

      const tempTs = Date.now();

      // 1. Push a streaming placeholder immediately so user sees feedback right away
      const streamingEntry = { type: 'prompt-streaming', prompt: '', ts: tempTs };

      if (view.value === 'adventure') {
        activeMessages.value.push({
          id: 'streaming-' + tempTs,
          role: 'bot',
          botId: null,
          botName: 'Image',
          content: '',
          isImage: true,
          isPromptStreaming: true,
          imagePrompt: '',
          imageUrl: null,
          ts: tempTs
        });
        scrollToBottom(messagesArea);
      } else if (view.value === 'story') {
        storyChunks.value.push(streamingEntry);
        scrollToBottom(storyBody);
      }

      try {
        // 2. Generate prompt with streaming — update the placeholder live
        const prompt = await AI.generateImagePrompt(
          activeBots.value,
          activeSession.value.scenario,
          activeSession.value.summary || null,
          settings.value,
          (piece, full) => {
            if (view.value === 'adventure') {
              const idx = activeMessages.value.findIndex(m => m.ts === tempTs && m.isPromptStreaming);
              if (idx >= 0) activeMessages.value[idx] = { ...activeMessages.value[idx], imagePrompt: full };
            } else if (view.value === 'story') {
              const idx = storyChunks.value.findIndex(c => c.ts === tempTs && c.type === 'prompt-streaming');
              if (idx >= 0) storyChunks.value[idx] = { ...storyChunks.value[idx], prompt: full };
            }
          }
        );

        const imageId = DB.generateId();
        const imageTs = Date.now();

        // 3. Replace streaming placeholder with real image entry (no URL yet)
        if (view.value === 'adventure') {
          const idx = activeMessages.value.findIndex(m => m.ts === tempTs && m.isPromptStreaming);
          const realEntry = {
            id: imageId,
            role: 'bot',
            botId: null,
            botName: 'Image',
            content: '',
            isImage: true,
            isPromptStreaming: false,
            imagePrompt: prompt,
            imageUrl: null,
            ts: imageTs
          };
          if (idx >= 0) activeMessages.value.splice(idx, 1, realEntry);
          else activeMessages.value.push(realEntry);
          activeSession.value.messages = [...activeMessages.value];
          activeSession.value.updatedAt = Date.now();
          await DB.putOne('adventures', toPlain(activeSession.value));
        } else if (view.value === 'story') {
          const idx = storyChunks.value.findIndex(c => c.ts === tempTs && c.type === 'prompt-streaming');
          const realEntry = { type: 'image', prompt, imageUrl: null, ts: imageTs };
          if (idx >= 0) storyChunks.value.splice(idx, 1, realEntry);
          else storyChunks.value.push(realEntry);
          activeSession.value.chunks = [...storyChunks.value];
          activeSession.value.updatedAt = Date.now();
          await DB.putOne('stories', toPlain(activeSession.value));
        }

        await loadAll();
        if (view.value === 'adventure') scrollToBottom(messagesArea);
        else scrollToBottom(storyBody);

        // 4. Load actual image in background
        const imageUrl = getImageUrl(prompt, Math.floor(Math.random() * 2147483647));
        const img = new Image();
        img.onload = async () => {
          if (view.value === 'adventure') {
            const idx = activeMessages.value.findIndex(m => m.id === imageId);
            if (idx >= 0) activeMessages.value[idx] = { ...activeMessages.value[idx], imageUrl };
            activeSession.value.messages = [...activeMessages.value];
            await DB.putOne('adventures', toPlain(activeSession.value));
          } else if (view.value === 'story') {
            const idx = storyChunks.value.findIndex(c => c.ts === imageTs && c.type === 'image');
            if (idx >= 0) storyChunks.value[idx] = { ...storyChunks.value[idx], imageUrl };
            activeSession.value.chunks = [...storyChunks.value];
            await DB.putOne('stories', toPlain(activeSession.value));
          }
          await loadAll();
        };
        img.src = imageUrl;
      } catch (err) {
        // Clean up the streaming placeholder on error
        if (view.value === 'adventure') {
          const idx = activeMessages.value.findIndex(m => m.ts === tempTs && m.isPromptStreaming);
          if (idx >= 0) activeMessages.value.splice(idx, 1);
        } else if (view.value === 'story') {
          const idx = storyChunks.value.findIndex(c => c.ts === tempTs && c.type === 'prompt-streaming');
          if (idx >= 0) storyChunks.value.splice(idx, 1);
        }
        showError('Image generation error: ' + err.message);
      }
      isGeneratingImage.value = false;
    }

    function toggleDirector() {
      directorMode.value = !directorMode.value;
      nextTick(() => chatInput.value?.focus());
    }

    async function handleSend() {
      if (view.value === 'chat') {
        await sendMessage();
      } else if (view.value === 'adventure') {
        await sendAdventureMessage();
      } else if (view.value === 'story') {
        await sendStoryMessage();
      }
    }

    function stopGeneration() {
      AI.abortCurrent();
    }

    async function sendMessage() {
      const text = inputText.value.trim();
      if (!text || isLoading.value) return;

      const mentionMatch = text.match(/@(\w[\w\s]*?)(?:\s|$)/);
      let resolvedMention = mentionedBot.value;
      if (mentionMatch && !resolvedMention) {
        const name = mentionMatch[1].trim().toLowerCase();
        resolvedMention = activeBots.value.find(b => b.name.toLowerCase() === name);
      }

      const userMsg = { id: DB.generateId(), role: 'user', content: text, ts: Date.now() };
      activeMessages.value.push(userMsg);
      inputText.value = '';
      mentionedBot.value = null;
      mentionSuggestions.value = [];
      scrollToBottom(messagesArea);

      const botMsgId = DB.generateId();
      const botMsg = { id: botMsgId, role: 'bot', botId: null, botName: '...', content: '', streaming: true, ts: Date.now() };
      activeMessages.value.push(botMsg);
      scrollToBottom(messagesArea);
      isLoading.value = true;

      try {
        const result = await AI.sendSimpleChat(
          activeMessages.value.filter(m => !m.streaming),
          activeBots.value,
          resolvedMention ? resolvedMention.id : null,
          settings.value,
          (piece, full) => {
            const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
            if (idx >= 0) {
              activeMessages.value[idx] = { ...activeMessages.value[idx], content: full };
            }
            scrollToBottom(messagesArea);
          }
        );

        const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
        if (idx >= 0) {
          activeMessages.value[idx] = {
            ...activeMessages.value[idx],
            botId: result.botId,
            botName: result.botName,
            content: result.content,
            streaming: false
          };
        }

        activeSession.value.messages = [...activeMessages.value];
        activeSession.value.lastMessage = result.content.substring(0, 60);
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('chats', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(messagesArea);
      } catch (err) {
        const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
        if (idx >= 0) {
          const finalContent = activeMessages.value[idx].content.trim();
          if (finalContent) {
            activeMessages.value[idx] = { ...activeMessages.value[idx], streaming: false };
            activeSession.value.messages = [...activeMessages.value];
            activeSession.value.lastMessage = finalContent.substring(0, 60);
            activeSession.value.updatedAt = Date.now();
            await DB.putOne('chats', toPlain(activeSession.value));
            await loadAll();
          } else {
            activeMessages.value.splice(idx, 1);
          }
        }
        if (err.message !== 'ABORTED') {
          showError('AI error: ' + err.message);
        }
      }
      isLoading.value = false;
    }

    // ===== ADVENTURE =====
    function openAdventure(adv) {
      activeSession.value = adv;
      activeMessages.value = adv.messages || [];
      directorMode.value = false;
      navigate('adventure');
      scrollToBottom(messagesArea);
    }

    async function sendAdventureMessage() {
      const text = inputText.value.trim();
      if (!text || isLoading.value) return;

      const userMsg = { id: DB.generateId(), role: 'user', content: text, isDirector: directorMode.value, ts: Date.now() };
      activeMessages.value.push(userMsg);
      inputText.value = '';
      directorMode.value = false;
      scrollToBottom(messagesArea);
      const botMsgId = DB.generateId();
      const botMsg = { id: botMsgId, role: 'bot', botId: null, botName: '...', content: '', streaming: true, ts: Date.now() };
      activeMessages.value.push(botMsg);
      scrollToBottom(messagesArea);
      isLoading.value = true;

      try {
        const result = await AI.sendAdventureMessage(
          activeMessages.value.filter(m => !m.streaming),
          activeBots.value,
          activeSession.value,
          directorMode.value,
          settings.value,
          (piece, full) => {
            const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
            if (idx >= 0) {
              activeMessages.value[idx] = { ...activeMessages.value[idx], content: full };
            }
            scrollToBottom(messagesArea);
          }
        );

        const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
        if (idx >= 0) activeMessages.value.splice(idx, 1);

        if (result.narrator) {
          activeMessages.value.push({
            id: DB.generateId(), role: 'bot', botId: null, botName: 'Narrator',
            content: result.narrator, isNarrator: true, ts: Date.now()
          });
        }

        activeMessages.value.push({
          id: DB.generateId(), role: 'bot', botId: result.botId, botName: result.botName,
          content: result.content, isDirector: false, ts: Date.now()
        });

        activeSession.value.messages = [...activeMessages.value];
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('adventures', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(messagesArea);
      } catch (err) {
        const idx = activeMessages.value.findIndex(m => m.id === botMsgId);
        if (idx >= 0) {
          const finalContent = activeMessages.value[idx].content.trim();
          if (finalContent) {
            activeMessages.value[idx] = { ...activeMessages.value[idx], streaming: false };
            activeSession.value.messages = [...activeMessages.value];
            activeSession.value.updatedAt = Date.now();
            await DB.putOne('adventures', toPlain(activeSession.value));
            await loadAll();
          } else {
            activeMessages.value.splice(idx, 1);
          }
        }
        if (err.message !== 'ABORTED') {
          showError('AI error: ' + err.message);
        }
      }
      isLoading.value = false;
    }

    // ===== STORY =====
    function openSummaryModal() {
      summaryModalOpen.value = true;
    }

    function openStory(story) {
      activeSession.value = story;
      storyChunks.value = (story.chunks || []).filter(c => c !== null && c !== undefined);
      if (story.summary) activeSession.value.summary = story.summary;
      directorMode.value = false;
      navigate('story');
    }

    async function sendStoryMessage() {
      const text = inputText.value.trim();
      if (isLoading.value) return;

      const isFirst = storyChunks.value.length === 0;
      const isDirector = directorMode.value;

      // Director mode always requires text
      if (isDirector && !text) return;

      // Continue story — just press send, no text needed
      if (!isFirst && !isDirector) {
        inputText.value = '';
        await generateStoryChunk(false, null);
        return;
      }

      if (isDirector) {
        const directorChunk = { type: 'director', content: text };
        storyChunks.value.push(directorChunk);
        inputText.value = '';
        directorMode.value = false;
        scrollToBottom(storyBody);
        await generateStoryChunk(false, text);
        return;
      }

      // Begin story — press send with empty input to start
      inputText.value = '';
      await generateStoryChunk(true, null);
    }

    async function generateStoryChunk(isFirst, directorInput = null) {
      if (isLoading.value) return;
      isLoading.value = true;

      const streamingChunkIndex = storyChunks.value.length;
      storyChunks.value.push({ type: 'streaming', content: '' });
      scrollToBottom(storyBody);

      try {
        const chunk = await AI.generateStoryChunk(
          storyChunks.value.filter(c => typeof c === 'string'),
          activeBots.value,
          activeSession.value,
          settings.value,
          directorInput,
          (piece, full) => {
            storyChunks.value[streamingChunkIndex] = { type: 'streaming', content: full };
            scrollToBottom(storyBody);
          }
        );

        storyChunks.value[streamingChunkIndex] = chunk;
        activeSession.value.chunks = [...storyChunks.value];
        activeSession.value.updatedAt = Date.now();
        await DB.putOne('stories', toPlain(activeSession.value));
        await loadAll();
        scrollToBottom(storyBody);

        // Generate summary in background
        AI.generateStorySummary(
          storyChunks.value.filter(c => typeof c === 'string'),
          activeBots.value,
          activeSession.value,
          settings.value
        ).then(async (summary) => {
          activeSession.value.summary = summary;
          await DB.putOne('stories', toPlain(activeSession.value));
        }).catch(() => { /* silently ignore */ });

      } catch (err) {
        const finalContent = storyChunks.value[streamingChunkIndex]?.content?.trim();
        if (finalContent) {
          storyChunks.value[streamingChunkIndex] = finalContent;
          activeSession.value.chunks = [...storyChunks.value];
          activeSession.value.updatedAt = Date.now();
          await DB.putOne('stories', toPlain(activeSession.value));
          await loadAll();
        } else {
          storyChunks.value.splice(streamingChunkIndex, 1);
        }
        if (err.message !== 'ABORTED') {
          showError('AI error: ' + err.message);
        }
      }
      isLoading.value = false;
    }

    // ===== STORY SEGMENT EDIT =====
    function startEditSegment(chunkIdx, segIdx, seg) {
      editingSegKey.value = `${chunkIdx}-${segIdx}`;
      tappedSegKey.value = seg;
      editSegText.value = seg.raw;
      modal.value = 'editProse';
    }

    function saveSegmentEditFromModal() {
      // Parse the key to get chunk and segment indices
      if (!editingSegKey.value) return;
      const [chunkIdx, segIdx] = editingSegKey.value.split('-').map(Number);
      const oldSeg = tappedSegKey.value;
      if (!oldSeg) return;

      const newRaw = editSegText.value.trim();
      const chunk = storyChunks.value[chunkIdx];

      if (typeof chunk === 'string') {
        storyChunks.value[chunkIdx] = chunk.replace(oldSeg.raw, newRaw);
      }

      cancelEdit();
      modal.value = null;
      activeSession.value.chunks = [...storyChunks.value];
      activeSession.value.updatedAt = Date.now();
      DB.putOne('stories', toPlain(activeSession.value));
    }

    async function deleteSegmentEdit(chunkIdx, segIdx) {
      const chunk = storyChunks.value[chunkIdx];
      if (typeof chunk === 'string') {
        const segs = parseProseSegments(chunk);
        const segToDelete = segs[segIdx];
        if (segToDelete && segToDelete.raw) {
          let newChunk = chunk.replace(segToDelete.raw, '').replace(/\s+/g, ' ').trim();
          if (!newChunk) {
            storyChunks.value.splice(chunkIdx, 1);
          } else {
            storyChunks.value[chunkIdx] = newChunk;
          }
        }
      }
      cancelEdit();
      activeSession.value.chunks = [...storyChunks.value];
      activeSession.value.updatedAt = Date.now();
      await DB.putOne('stories', toPlain(activeSession.value));
    }

    function deleteSegmentEditFromModal() {
      if (!editingSegKey.value) return;
      const [chunkIdx, segIdx] = editingSegKey.value.split('-').map(Number);
      deleteSegmentEdit(chunkIdx, segIdx);
      modal.value = null;
    }

    function cancelEdit() {
      editingSegKey.value = null;
      editSegText.value = '';
      editSegType.value = 'narrate';
      tappedSegKey.value = null;
    }

    function handleSegTap(key) {
      if (!isTouchDevice.value) return;
      tappedSegKey.value = (tappedSegKey.value === key) ? null : key;
    }

    async function saveSegmentEdit(chunkIdx, segIdx, oldSeg) {
      const newRaw = editSegText.value.trim();
      const chunk = storyChunks.value[chunkIdx];

      if (typeof chunk === 'string') {
        storyChunks.value[chunkIdx] = chunk.replace(oldSeg.raw, newRaw);
      }

      cancelEdit();
      activeSession.value.chunks = [...storyChunks.value];
      activeSession.value.updatedAt = Date.now();
      await DB.putOne('stories', toPlain(activeSession.value));
    }

    // ===== DELETE =====
    async function deleteChat(id) {
      if (!confirm('Delete this chat?')) return;
      await DB.deleteOne('chats', id);
      await loadAll();
    }

    async function deleteAdventure(id) {
      if (!confirm('Delete this adventure?')) return;
      await DB.deleteOne('adventures', id);
      await loadAll();
    }

    async function deleteStory(id) {
      if (!confirm('Delete this story?')) return;
      await DB.deleteOne('stories', id);
      await loadAll();
    }

    // ===== IMPORT / EXPORT =====
    function downloadJSON(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    async function exportAll() {
      const data = await DB.exportAllData();
      downloadJSON(data, 'lorechat-backup.json');
    }

    function triggerImport() { importFile.value.click(); }

    async function importAll(e) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await DB.importAllData(data);
        await loadAll();
        alert('Import successful!');
      } catch (err) {
        showError('Import failed: ' + err.message);
      }
      e.target.value = '';
    }

    // ===== INIT =====
    onMounted(async () => {
      isTouchDevice.value = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      injectIconStyles();
      await loadAll();
      watch(storyChunks, () => { setTimeout(updateChunkNavState, 300); }, { deep: true });
      document.addEventListener('click', (e) => {
        if (chatMenu.value && kebabMenuRef.value && !kebabMenuRef.value.contains(e.target)) {
          chatMenu.value = false;
        }
      });
      await nextTick();
      document.getElementById('app-loader').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    });

    return {
      view, viewHistory, homeTab, modal, settingsSaved, errorMsg, isLoading, directorMode, chatMenu,
      bots, chats, adventures, stories, settings,
      activeSession, activeMessages, storyChunks, activeBots,
      inputText, mentionedBot, mentionSuggestions,
      newSession, editingBot,
      messagesArea, storyBody, chatInput, importFile, kebabMenuRef,
      botColors: BOT_COLORS,
      botEmojis: BOT_EMOJIS,
      getAdventureRenderUnits, getBotColor, getBotInitial, getBotEmoji, formatTime, parseProseSegments,
      kebabClearLabel, kebabDeleteLabel, kebabDelete,
      inputPlaceholder, inputDisabled,
      navigate, goBack,
      saveSettings,
      openBotModal, editBot, saveBot, deleteBot, deleteBotFromModal, exportBots,
      openCreateModal, toggleBotSelection, createSession,
      openChat, clearSession, onInput, insertAt, selectMention, sendMessage,
      openAdventure, sendAdventureMessage,
      openStory, generateStoryChunk, sendStoryMessage,
      canNavUp, canNavDown, scrollToChunkDivider, updateChunkNavState,
      editingSegKey, editSegText, editSegType,
      isTouchDevice, tappedSegKey,
      startEditSegment, cancelEdit, saveSegmentEdit, saveSegmentEditFromModal, deleteSegmentEdit, deleteSegmentEditFromModal, handleSegTap,
      deleteChat, deleteAdventure, deleteStory,
      exportAll, triggerImport, importAll,
      summaryModalOpen, openSummaryModal,
      handleSend, handleImageGenerate, redoImage, reimagineImage, removeImage, isGeneratingImage, getImageUrl,
      stopGeneration,
      toggleDirector, svg
    };
  }
}).mount('#app');