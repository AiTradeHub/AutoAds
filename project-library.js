(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const DB_NAME = 'autoads-local-projects';
  const DB_VERSION = 1;
  const STORE = 'projects';
  let dbPromise;

  function status(message, isError = false) {
    const node = $('projectLibraryStatus');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? '#ffb4b4' : '';
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Acest browser nu permite stocarea locală necesară.'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Baza locală nu a putut fi deschisă.'));
      request.onblocked = () => reject(new Error('Închide celelalte file AutoAds și încearcă din nou.'));
    });
    return dbPromise;
  }

  async function allProjects() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt - a.updatedAt));
      request.onerror = () => reject(request.error || new Error('Nu am putut citi proiectele.'));
    });
  }

  async function putProject(project) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Proiectul nu a putut fi salvat.'));
      tx.onabort = () => reject(tx.error || new Error('Salvarea proiectului a fost anulată.'));
    });
  }

  async function removeProject(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Proiectul nu a putut fi șters.'));
    });
  }

  function currentProject() {
    const files = Array.from($('mediaInput').files || []);
    const title = $('projectName').value.trim() || $('product').value.trim() || $('business').value.trim() || 'Proiect AutoAds';
    return {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2)),
      name: title.slice(0, 80),
      updatedAt: Date.now(),
      fields: {
        business: $('business').value,
        product: $('product').value,
        details: $('details').value,
        tone: $('tone').value,
        goal: $('goal').value,
        platform: document.querySelector('[data-platform].selected')?.dataset.platform || 'TikTok',
        format: $('formatSelect').value,
        position: $('overlayPosition').value,
        style: $('overlayStyle').value,
        ctaText: $('ctaText').value,
        outTitle: $('outTitle').value,
        outCaption: $('outCaption').value
      },
      media: files
    };
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function safeButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  async function renderProjects() {
    const container = $('savedProjects');
    container.replaceChildren();
    let projects;
    try {
      projects = await allProjects();
    } catch (error) {
      status(error.message || 'Nu am putut încărca proiectele salvate.', true);
      return;
    }
    if (!projects.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Nu ai încă proiecte salvate.';
      container.appendChild(empty);
      return;
    }
    projects.forEach((project) => {
      const row = document.createElement('div');
      row.className = 'saved-project';
      const info = document.createElement('div');
      info.className = 'saved-project-info';
      const name = document.createElement('strong');
      name.textContent = project.name || 'Proiect AutoAds';
      const meta = document.createElement('small');
      const date = new Date(project.updatedAt).toLocaleString('ro-RO', { dateStyle: 'short', timeStyle: 'short' });
      const count = (project.media || []).length;
      const bytes = (project.media || []).reduce((sum, file) => sum + (file.size || 0), 0);
      meta.textContent = date + ' · ' + count + ' fișier(e) · ' + formatSize(bytes);
      info.append(name, meta);
      const actions = document.createElement('div');
      actions.className = 'saved-project-actions';
      actions.append(
        safeButton('Deschide', 'secondary', () => loadProject(project.id)),
        safeButton('Șterge', 'secondary danger', () => deleteProject(project.id, project.name))
      );
      row.append(info, actions);
      container.appendChild(row);
    });
  }

  async function saveProject() {
    const project = currentProject();
    if (!project.fields.business.trim() && !project.fields.product.trim() && !project.fields.details.trim() && !project.media.length) {
      status('Completează detaliile reclamei sau adaugă un material înainte de salvare.', true);
      return;
    }
    $('saveProject').disabled = true;
    $('saveProject').textContent = 'Se salvează…';
    try {
      await putProject(project);
      $('projectName').value = project.name;
      status('Proiectul „' + project.name + '” a fost salvat local, împreună cu ' + project.media.length + ' fișier(e).');
      await renderProjects();
    } catch (error) {
      status('Salvarea a eșuat. ' + (error.name === 'QuotaExceededError' ? 'Spațiul local poate fi insuficient; șterge proiecte sau fișiere mari.' : (error.message || 'Încearcă din nou.')), true);
    } finally {
      $('saveProject').disabled = false;
      $('saveProject').textContent = 'Salvează proiectul';
    }
  }

  async function loadProject(id) {
    try {
      const project = (await allProjects()).find((item) => item.id === id);
      if (!project) {
        status('Proiectul nu mai există în stocarea locală.', true);
        await renderProjects();
        return;
      }
      const f = project.fields || {};
      ['business', 'product', 'details', 'tone', 'goal', 'outTitle', 'outCaption'].forEach((key) => {
        if ($(key) && f[key] !== undefined) $(key).value = f[key];
      });
      $('projectName').value = project.name || '';
      const platform = f.platform || 'TikTok';
      const platformButton = Array.from(document.querySelectorAll('[data-platform]')).find((button) => button.dataset.platform === platform);
      if (platformButton) platformButton.click();
      if (f.format) $('formatSelect').value = f.format;
      if (f.position) $('overlayPosition').value = f.position;
      if (f.style) $('overlayStyle').value = f.style;
      $('ctaText').value = f.ctaText || 'AFLĂ MAI MULTE';
      ['formatSelect', 'overlayPosition', 'overlayStyle'].forEach((key) => $(key).dispatchEvent(new Event('change', { bubbles: true })));
      $('ctaText').dispatchEvent(new Event('input', { bubbles: true }));
      $('hookOverlay').textContent = (f.outTitle || '').toLocaleUpperCase('ro-RO');
      $('productOverlay').textContent = f.product || 'Reclama ta';
      $('ctaOverlay').textContent = (f.ctaText || 'AFLĂ MAI MULTE').toLocaleUpperCase('ro-RO') + ' →';
      if (f.outCaption || f.outTitle) $('outputCard').classList.add('show');
      else $('outputCard').classList.remove('show');

      const transfer = new DataTransfer();
      (project.media || []).forEach((file) => transfer.items.add(file));
      $('mediaInput').files = transfer.files;
      $('mediaInput').dispatchEvent(new Event('change', { bubbles: true }));
      status('Proiectul „' + project.name + '” a fost deschis.');
      $('projectLibraryCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      status('Nu am putut deschide proiectul. ' + (error.message || 'Browserul poate să nu permită restaurarea fișierelor.'), true);
    }
  }

  async function deleteProject(id, name) {
    if (!window.confirm('Ștergi proiectul „' + name + '” și copiile locale ale materialelor sale?')) return;
    try {
      await removeProject(id);
      status('Proiectul „' + name + '” a fost șters din acest browser.');
      await renderProjects();
    } catch (error) {
      status(error.message || 'Proiectul nu a putut fi șters.', true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('saveProject')?.addEventListener('click', saveProject);
    renderProjects();
  });
})();