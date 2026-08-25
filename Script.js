/**
 * DEFOL AI - Core Engine (Modular Architecture)
 * Version: 1.0.0
 * Pure Client-side (No backend required)
 */

// =============================================================================
// 1. DATABASE MODULE (IndexedDB untuk Riwayat Gambar Lokal)
// =============================================================================
const DBModule = (() => {
  const DB_NAME = 'DefolAIDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'history';
  const MAX_HISTORY_LIMIT = 40; // Batas gambar non-favorit agar hemat memori HP

  let db = null;

  const init = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const dbInstance = e.target.result;
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('isFavorite', 'isFavorite', { unique: false });
        }
      };

      request.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = (e) => reject(`IndexedDB Error: ${e.target.errorCode}`);
    });
  };

  const saveImage = async (item) => {
    if (!db) await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        id: item.id || Date.now(),
        imageData: item.imageData,
        prompt: item.prompt,
        model: item.model,
        provider: item.provider,
        aspectRatio: item.aspectRatio,
        quality: item.quality,
        createdAt: item.createdAt || new Date().toISOString(),
        isFavorite: item.isFavorite || false
      };

      const req = store.put(record);
      req.onsuccess = () => {
        pruneOldHistory();
        resolve(record);
      };
      req.onerror = () => reject('Gagal menyimpan gambar ke riwayat.');
    });
  };

  const getAllImages = async () => {
    if (!db) await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = req.result || [];
        items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(items);
      };
      req.onerror = () => reject('Gagal memuat galeri riwayat.');
    });
  };

  const getImageById = async (id) => {
    if (!db) await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.get(Number(id));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject('Gambar tidak ditemukan.');
    });
  };

  const deleteImage = async (id) => {
    if (!db) await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(Number(id));
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject('Gagal menghapus gambar.');
    });
  };

  const toggleFavorite = async (id) => {
    const item = await getImageById(id);
    if (!item) return null;
    item.isFavorite = !item.isFavorite;
    await saveImage(item);
    return item.isFavorite;
  };

  const clearNonFavoriteHistory = async () => {
    if (!db) await init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (!cursor.value.isFavorite) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve(true);
        }
      };
      req.onerror = () => reject('Gagal membersihkan riwayat.');
    });
  };

  const pruneOldHistory = async () => {
    const all = await getAllImages();
    const nonFavs = all.filter((img) => !img.isFavorite);
    if (nonFavs.length > MAX_HISTORY_LIMIT) {
      const toDelete = nonFavs.slice(MAX_HISTORY_LIMIT);
      for (const img of toDelete) {
        await deleteImage(img.id);
      }
    }
  };

  return { init, saveImage, getAllImages, getImageById, deleteImage, toggleFavorite, clearNonFavoriteHistory };
})();

// =============================================================================
// 2. STORAGE MODULE (LocalStorage untuk Pengaturan & Multi-Key)
// =============================================================================
const StorageModule = (() => {
  const KEYS = {
    ACTIVE_PROVIDER: 'defol_active_provider',
    PROVIDER_KEYS: 'defol_keys',
    CUSTOM_URL: 'defol_custom_url',
    CUSTOM_MODELS: 'defol_custom_models',
    LAST_RATIO: 'defol_last_ratio',
    LAST_QUALITY: 'defol_last_quality'
  };

  const getActiveProvider = () => localStorage.getItem(KEYS.ACTIVE_PROVIDER) || 'openrouter';
  const setActiveProvider = (provider) => localStorage.setItem(KEYS.ACTIVE_PROVIDER, provider);

  const getApiKeys = () => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.PROVIDER_KEYS)) || {};
    } catch {
      return {};
    }
  };

  const getApiKeyFor = (provider) => {
    const keys = getApiKeys();
    return keys[provider] || '';
  };

  const setApiKeyFor = (provider, key) => {
    const keys = getApiKeys();
    keys[provider] = key;
    localStorage.setItem(KEYS.PROVIDER_KEYS, JSON.stringify(keys));
  };

  const getCustomUrl = () => localStorage.getItem(KEYS.CUSTOM_URL) || '';
  const setCustomUrl = (url) => localStorage.setItem(KEYS.CUSTOM_URL, url);

  const getCustomModels = () => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.CUSTOM_MODELS)) || [];
    } catch {
      return [];
    }
  };

  const addCustomModel = (modelObj) => {
    const models = getCustomModels();
    if (!models.some((m) => m.id === modelObj.id)) {
      models.push(modelObj);
      localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify(models));
    }
  };

  const removeCustomModel = (modelId) => {
    let models = getCustomModels();
    models = models.filter((m) => m.id !== modelId);
    localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify(models));
  };

  return {
    getActiveProvider,
    setActiveProvider,
    getApiKeyFor,
    setApiKeyFor,
    getCustomUrl,
    setCustomUrl,
    getCustomModels,
    addCustomModel,
    removeCustomModel
  };
})();

// =============================================================================
// 3. MODEL MANAGER (Preset Model & Dokumentasi Resmi)
// =============================================================================
const ModelManager = (() => {
  const PRESET_MODELS = {
    openrouter: [
      { id: 'black-forest-labs/flux-1-schnell', label: 'Flux Schnell [Hemat/Cepat]' },
      { id: 'black-forest-labs/flux-1-dev', label: 'Flux Dev [Kualitas Tinggi]' },
      { id: 'stabilityai/stable-diffusion-3-medium', label: 'SD 3 Medium' },
      { id: 'stabilityai/sdxl-turbo', label: 'SDXL Turbo [Instan]' }
    ],
    cometapi: [
      { id: 'gpt-4o-image', label: 'GPT-4o Visual Image' },
      { id: 'dall-e-3', label: 'DALL-E 3' },
      { id: 'flux-pro', label: 'Flux Pro (Comet)' }
    ],
    custom: []
  };

  const DOC_URLS = {
    openrouter: 'https://openrouter.ai/models?category=image-generation',
    cometapi: 'https://api.cometapi.com',
    custom: 'https://google.com'
  };

  const getModelsForProvider = (provider) => {
    const presets = PRESET_MODELS[provider] || [];
    const customModels = StorageModule.getCustomModels();
    return [...presets, ...customModels];
  };

  const getDocUrl = (provider) => DOC_URLS[provider] || DOC_URLS.custom;

  return { getModelsForProvider, getDocUrl };
})();

// =============================================================================
// 4. API SERVICE (Smart Payload & Endpoint Engine)
// =============================================================================
const ApiService = (() => {
  const RATIO_PIXEL_MAP = {
    '1:1': '1024x1024',
    '9:16': '1024x1792',
    '16:9': '1792x1024',
    '4:5': '896x1120',
    '3:4': '768x1024',
    '4:3': '1024x768',
    '21:9': '1536x640'
  };

  const generateImage = async ({ provider, apiKey, model, prompt, aspectRatio, quality, customUrl }) => {
    let endpoint = '';
    if (provider === 'openrouter') {
      endpoint = 'https://openrouter.ai/api/v1/images/generations';
    } else if (provider === 'cometapi') {
      endpoint = 'https://api.cometapi.com/v1/images/generations';
    } else {
      endpoint = customUrl;
    }

    if (!endpoint) throw new Error('Endpoint URL tidak valid.');
    if (!apiKey) throw new Error('API Key belum diisi!');
    if (!prompt) throw new Error('Prompt tidak boleh kosong!');

    // Membangun JSON Payload cerdas (Fail-Safe)
    const payload = {
      model: model,
      prompt: prompt
    };

    // Sesuaikan parameter ukuran berdasarkan provider
    if (provider === 'openrouter') {
      payload.aspect_ratio = aspectRatio;
    } else {
      payload.size = RATIO_PIXEL_MAP[aspectRatio] || '1024x1024';
    }

    // Hanya kirim quality jika user sengaja memilih selain Auto
    if (quality && quality !== 'auto') {
      payload.quality = quality;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      let errMsg = `Error ${response.status}: `;
      if (data && data.error) {
        errMsg += typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
      } else {
        errMsg += response.statusText;
      }
      throw new Error(errMsg);
    }

    // Ekstraksi data gambar (mendukung format URL langsung maupun Base64)
    let finalImageUrl = '';
    if (data.data && data.data.length > 0) {
      if (data.data[0].url) {
        finalImageUrl = data.data[0].url;
      } else if (data.data[0].b64_json) {
        finalImageUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      }
    }

    if (!finalImageUrl) {
      throw new Error('API merespon sukses tetapi format gambar tidak ditemukan dalam response.');
    }

    return finalImageUrl;
  };

  return { generateImage };
})();

// =============================================================================
// 5. UI CONTROLLER (Event Listeners, DOM & State Management)
// =============================================================================
const UIController = (() => {
  // DOM Elemen
  const providerSelect = document.getElementById('providerSelect');
  const customUrlWrapper = document.getElementById('customUrlWrapper');
  const customUrlInput = document.getElementById('customUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleApiKeyBtn = document.getElementById('toggleApiKeyBtn');
  const activeProviderBadge = document.getElementById('activeProviderBadge');

  const modelSelect = document.getElementById('modelSelect');
  const docLinkBtn = document.getElementById('docLinkBtn');
  const openModelModalBtn = document.getElementById('openModelModalBtn');
  const aspectRatioSelect = document.getElementById('aspectRatioSelect');
  const qualitySelect = document.getElementById('qualitySelect');

  const promptInput = document.getElementById('promptInput');
  const clearPromptBtn = document.getElementById('clearPromptBtn');
  const generateBtn = document.getElementById('generateBtn');
  const btnGenerateText = document.getElementById('btnGenerateText');
  const btnSpinner = document.getElementById('btnSpinner');
  const statusAlert = document.getElementById('statusAlert');

  const activeResultCard = document.getElementById('activeResultCard');
  const activeResultImg = document.getElementById('activeResultImg');
  const activeFavoriteBtn = document.getElementById('activeFavoriteBtn');
  const activeDownloadBtn = document.getElementById('activeDownloadBtn');
  const activeShareBtn = document.getElementById('activeShareBtn');

  // Galeri & Navigasi
  const navItems = document.querySelectorAll('.nav-item');
  const tabStudio = document.getElementById('tabStudio');
  const tabGallery = document.getElementById('tabGallery');
  const galleryGrid = document.getElementById('galleryGrid');
  const galleryCount = document.getElementById('galleryCount');
  const emptyGalleryMsg = document.getElementById('emptyGalleryMsg');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');

  // Modal Detail
  const imageDetailModal = document.getElementById('imageDetailModal');
  const closeDetailModalBtn = document.getElementById('closeDetailModalBtn');
  const modalDetailImg = document.getElementById('modalDetailImg');
  const modalModelText = document.getElementById('modalModelText');
  const modalRatioText = document.getElementById('modalRatioText');
  const modalDateText = document.getElementById('modalDateText');
  const modalPromptText = document.getElementById('modalPromptText');
  const modalReusePromptBtn = document.getElementById('modalReusePromptBtn');
  const modalCopyPromptBtn = document.getElementById('modalCopyPromptBtn');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalShareBtn = document.getElementById('modalShareBtn');
  const modalToggleFavBtn = document.getElementById('modalToggleFavBtn');
  const modalDeleteBtn = document.getElementById('modalDeleteBtn');

  // Modal Model Manager
  const modelManagerModal = document.getElementById('modelManagerModal');
  const closeModelModalBtn = document.getElementById('closeModelModalBtn');
  const newModelId = document.getElementById('newModelId');
  const newModelLabel = document.getElementById('newModelLabel');
  const addNewModelBtn = document.getElementById('addNewModelBtn');
  const modelListContainer = document.getElementById('modelListContainer');

  let currentActiveImageRecord = null;
  let currentDetailModalId = null;

  // Inisialisasi awal aplikasi
  const initApp = async () => {
    await DBModule.init();
    loadStoredSettings();
    renderModelDropdown();
    renderGallery();
    setupEventListeners();
  };

  const loadStoredSettings = () => {
    const activeProvider = StorageModule.getActiveProvider();
    providerSelect.value = activeProvider;
    updateProviderBadge(activeProvider);

    apiKeyInput.value = StorageModule.getApiKeyFor(activeProvider);
    customUrlInput.value = StorageModule.getCustomUrl();

    if (activeProvider === 'custom') {
      customUrlWrapper.classList.remove('hidden');
    } else {
      customUrlWrapper.classList.add('hidden');
    }

    docLinkBtn.href = ModelManager.getDocUrl(activeProvider);
  };

  const updateProviderBadge = (provider) => {
    const names = {
      openrouter: 'OpenRouter',
      cometapi: 'Comet API',
      custom: 'Custom API'
    };
    activeProviderBadge.textContent = names[provider] || 'API';
  };

  const renderModelDropdown = () => {
    const activeProvider = providerSelect.value;
    const models = ModelManager.getModelsForProvider(activeProvider);
    modelSelect.innerHTML = '';

    models.forEach((m) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label || m.id;
      modelSelect.appendChild(opt);
    });
  };

  const renderGallery = async () => {
    const images = await DBModule.getAllImages();
    galleryGrid.innerHTML = '';
    galleryCount.textContent = `${images.length} gambar tersimpan`;

    if (images.length === 0) {
      emptyGalleryMsg.classList.remove('hidden');
      return;
    }

    emptyGalleryMsg.classList.add('hidden');

    images.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `
        <img src="${item.imageData}" alt="${escapeHtml(item.prompt)}" loading="lazy">
        ${item.isFavorite ? '<span class="fav-badge">⭐</span>' : ''}
      `;
      card.addEventListener('click', () => openImageDetail(item.id));
      galleryGrid.appendChild(card);
    });
  };

  const renderModelManagerList = () => {
    const customModels = StorageModule.getCustomModels();
    modelListContainer.innerHTML = '';

    if (customModels.length === 0) {
      modelListContainer.innerHTML = '<small style="color:var(--text-sub);">Belum ada model custom.</small>';
      return;
    }

    customModels.forEach((m) => {
      const item = document.createElement('div');
      item.className = 'model-item';
      item.innerHTML = `
        <div class="model-item-info">
          <span class="model-item-title">${escapeHtml(m.label)}</span>
          <span class="model-item-id">${escapeHtml(m.id)}</span>
        </div>
        <button type="button" class="btn-del-model" data-id="${escapeHtml(m.id)}">✕</button>
      `;
      item.querySelector('.btn-del-model').addEventListener('click', () => {
        StorageModule.removeCustomModel(m.id);
        renderModelManagerList();
        renderModelDropdown();
      });
      modelListContainer.appendChild(item);
    });
  };

  // Event Listeners
  const setupEventListeners = () => {
    // 1. Tab Navigation
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        navItems.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const targetTab = btn.getAttribute('data-tab');
        if (targetTab === 'tabStudio') {
          tabStudio.classList.add('active');
          tabGallery.classList.remove('active');
        } else {
          tabStudio.classList.remove('active');
          tabGallery.classList.add('active');
          renderGallery();
        }
      });
    });

    // 2. Ganti Provider
    providerSelect.addEventListener('change', () => {
      const selected = providerSelect.value;
      StorageModule.setActiveProvider(selected);
      updateProviderBadge(selected);
      apiKeyInput.value = StorageModule.getApiKeyFor(selected);
      docLinkBtn.href = ModelManager.getDocUrl(selected);

      if (selected === 'custom') {
        customUrlWrapper.classList.remove('hidden');
      } else {
        customUrlWrapper.classList.add('hidden');
      }

      renderModelDropdown();
    });

    // 3. Simpan API Key & Custom URL saat diketik
    apiKeyInput.addEventListener('input', () => {
      StorageModule.setApiKeyFor(providerSelect.value, apiKeyInput.value.trim());
    });

    customUrlInput.addEventListener('input', () => {
      StorageModule.setCustomUrl(customUrlInput.value.trim());
    });

    // 4. Toggle Sembunyikan/Lihat Key
    toggleApiKeyBtn.addEventListener('click', () => {
      if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleApiKeyBtn.textContent = '🔒';
      } else {
        apiKeyInput.type = 'password';
        toggleApiKeyBtn.textContent = '👁️';
      }
    });

    // 5. Tombol Hapus Teks Prompt
    clearPromptBtn.addEventListener('click', () => {
      promptInput.value = '';
      promptInput.focus();
    });

    // 6. Tombol Utama: Buat Gambar
    generateBtn.addEventListener('click', async () => {
      const provider = providerSelect.value;
      const apiKey = apiKeyInput.value.trim();
      const model = modelSelect.value;
      const prompt = promptInput.value.trim();
      const aspectRatio = aspectRatioSelect.value;
      const quality = qualitySelect.value;
      const customUrl = customUrlInput.value.trim();

      if (!apiKey) {
        showStatus('Harap masukkan API Key provider ini!', 'error');
        return;
      }
      if (!prompt) {
        showStatus('Harap tulis deskripsi prompt terlebih dahulu!', 'error');
        return;
      }

      setLoading(true);
      showStatus('Sedang memproses generasi gambar ke API...', 'loading');
      activeResultCard.classList.add('hidden');

      try {
        const imageUrl = await ApiService.generateImage({
          provider,
          apiKey,
          model,
          prompt,
          aspectRatio,
          quality,
          customUrl
        });

        // Simpan gambar ke database IndexedDB
        const record = await DBModule.saveImage({
          imageData: imageUrl,
          prompt,
          model,
          provider: providerSelect.options[providerSelect.selectedIndex].text,
          aspectRatio,
          quality,
          isFavorite: false
        });

        currentActiveImageRecord = record;

        // Tampilkan ke antarmuka aktif
        activeResultImg.src = imageUrl;
        activeFavoriteBtn.textContent = record.isFavorite ? '⭐' : '☆';
        activeResultCard.classList.remove('hidden');

        showStatus('Gambar berhasil dibuat dan disimpan ke galeri!', 'success');
        setTimeout(hideStatus, 4000);

      } catch (err) {
        showStatus(err.message, 'error');
      } finally {
        setLoading(false);
      }
    });

    // 7. Favorite & Download di Studio Aktif
    activeFavoriteBtn.addEventListener('click', async () => {
      if (!currentActiveImageRecord) return;
      const isFav = await DBModule.toggleFavorite(currentActiveImageRecord.id);
      activeFavoriteBtn.textContent = isFav ? '⭐' : '☆';
      currentActiveImageRecord.isFavorite = isFav;
    });

    activeDownloadBtn.addEventListener('click', () => {
      if (currentActiveImageRecord) triggerDownload(currentActiveImageRecord.imageData, `defol-${Date.now()}.png`);
    });

    activeShareBtn.addEventListener('click', () => {
      if (currentActiveImageRecord) shareImage(currentActiveImageRecord.imageData, currentActiveImageRecord.prompt);
    });

    // 8. Modal Model Custom
    openModelModalBtn.addEventListener('click', () => {
      renderModelManagerList();
      modelManagerModal.classList.remove('hidden');
    });

    closeModelModalBtn.addEventListener('click', () => {
      modelManagerModal.classList.add('hidden');
    });

    addNewModelBtn.addEventListener('click', () => {
      const idVal = newModelId.value.trim();
      const labelVal = newModelLabel.value.trim() || idVal;

      if (!idVal) {
        alert('ID Model resmi tidak boleh kosong!');
        return;
      }

      StorageModule.addCustomModel({ id: idVal, label: labelVal });
      newModelId.value = '';
      newModelLabel.value = '';
      renderModelManagerList();
      renderModelDropdown();
    });

    // 9. Modal Detail Gambar Riwayat
    closeDetailModalBtn.addEventListener('click', () => {
      imageDetailModal.classList.add('hidden');
    });

    modalReusePromptBtn.addEventListener('click', async () => {
      if (!currentDetailModalId) return;
      const item = await DBModule.getImageById(currentDetailModalId);
      if (item) {
        promptInput.value = item.prompt;
        aspectRatioSelect.value = item.aspectRatio || '1:1';
        imageDetailModal.classList.add('hidden');
        // Pindah ke tab studio
        navItems[0].click();
      }
    });

    modalCopyPromptBtn.addEventListener('click', () => {
      if (modalPromptText.textContent) {
        navigator.clipboard.writeText(modalPromptText.textContent);
        alert('Prompt berhasil disalin ke clipboard!');
      }
    });

    modalDownloadBtn.addEventListener('click', async () => {
      if (!currentDetailModalId) return;
      const item = await DBModule.getImageById(currentDetailModalId);
      if (item) triggerDownload(item.imageData, `defol-${item.id}.png`);
    });

    modalShareBtn.addEventListener('click', async () => {
      if (!currentDetailModalId) return;
      const item = await DBModule.getImageById(currentDetailModalId);
      if (item) shareImage(item.imageData, item.prompt);
    });

    modalToggleFavBtn.addEventListener('click', async () => {
      if (!currentDetailModalId) return;
      const isFav = await DBModule.toggleFavorite(currentDetailModalId);
      modalToggleFavBtn.textContent = isFav ? '⭐ Hapus Bintang Favorit' : '☆ Tandai Favorit';
      renderGallery();
    });

    modalDeleteBtn.addEventListener('click', async () => {
      if (!currentDetailModalId) return;
      if (confirm('Hapus gambar ini secara permanen dari HP?')) {
        await DBModule.deleteImage(currentDetailModalId);
        imageDetailModal.classList.add('hidden');
        renderGallery();
      }
    });

    clearHistoryBtn.addEventListener('click', async () => {
      if (confirm('Hapus semua riwayat gambar yang BUKAN favorit? (Gambar bertanda bintang ⭐ akan tetap aman)')) {
        await DBModule.clearNonFavoriteHistory();
        renderGallery();
      }
    });
  };

  // Helper Functions
  const openImageDetail = async (id) => {
    currentDetailModalId = id;
    const item = await DBModule.getImageById(id);
    if (!item) return;

    modalDetailImg.src = item.imageData;
    modalModelText.textContent = item.model || '-';
    modalRatioText.textContent = item.aspectRatio || '1:1';
    modalDateText.textContent = new Date(item.createdAt).toLocaleString('id-ID');
    modalPromptText.textContent = item.prompt || '';
    modalToggleFavBtn.textContent = item.isFavorite ? '⭐ Hapus Bintang Favorit' : '☆ Tandai Favorit';

    imageDetailModal.classList.remove('hidden');
  };

  const setLoading = (loading) => {
    generateBtn.disabled = loading;
    if (loading) {
      btnGenerateText.textContent = 'Membuat Gambar...';
      btnSpinner.classList.remove('hidden');
    } else {
      btnGenerateText.textContent = 'Buat Gambar';
      btnSpinner.classList.add('hidden');
    }
  };

  const showStatus = (msg, type) => {
    statusAlert.textContent = msg;
    statusAlert.className = `status-alert ${type}`;
    statusAlert.classList.remove('hidden');
  };

  const hideStatus = () => {
    statusAlert.classList.add('hidden');
  };

  const triggerDownload = (dataUrl, filename) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const shareImage = async (dataUrl, promptText) => {
    if (navigator.share) {
      try {
        // Jika browser mendukung native Web Share
        await navigator.share({
          title: 'DEFOL AI Image',
          text: `Dibuat dengan DEFOL AI: "${promptText}"`,
          url: dataUrl.startsWith('http') ? dataUrl : undefined
        });
      } catch {
        // Abaikan jika user cancel
      }
    } else {
      // Fallback salin link atau prompt
      navigator.clipboard.writeText(promptText);
      alert('Prompt disalin ke clipboard! (Fitur Web Share tidak didukung penuh di browser ini)');
    }
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  return { initApp };
})();

// Jalankan Engine saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  UIController.initApp();
});
