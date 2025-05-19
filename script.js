// script.js (Complete)
document.addEventListener('DOMContentLoaded', () => {
    // Loading Area Elements
    const loadingArea = document.getElementById('loading-area');
    const bookSearchInput = document.getElementById('book-search');
    const repositoryBooksList = document.getElementById('repository-books-list');
    const fileInput = document.getElementById('file-input');
    const urlInput = document.getElementById('url-input');
    const loadUrlButton = document.getElementById('load-url');
    const loadingStatus = document.getElementById('loading-status');
    const recentBooksList = document.getElementById('recent-books-list');
    const clearRecentBooksButton = document.getElementById('clear-recent-books');
    const savedBooksSection = document.getElementById('saved-books-section');
    const savedBooksList = document.getElementById('saved-books-list');
    const clearSavedBooksButton = document.getElementById('clear-saved-books');

    // Book Reading Area Elements
    const bookContainer = document.getElementById('book-container');
    const pageLeft = document.getElementById('page-left');
    const pageRight = document.getElementById('page-right');

    // Sidebar Menu Elements
    const sideMenu = document.getElementById('side-menu');
    const menuToggle = document.getElementById('menu-toggle');
    const expandedMenuContent = document.getElementById('expanded-menu-content');
    const settingsToggle = document.getElementById('settings-toggle'); // New
    const collapsibleSettingsContent = document.getElementById('collapsible-settings-content'); // New
    const settingsArrow = document.getElementById('settings-arrow'); // New


    // Collapsed Sidebar Specific Content
    const collapsedSidebarContent = document.getElementById('collapsed-sidebar-content');
    const collapsedBookTitleDiv = document.getElementById('collapsed-book-title');
    const verticalBookTitleText = document.getElementById('vertical-book-title-text');
    const collapsedProgressDiv = document.getElementById('collapsed-progress');
    const simplePageInfo = document.getElementById('simple-page-info');

    // Settings Elements in Expanded Menu
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const justifyTextCheckbox = document.getElementById('justify-text');
    const menuPageInfo = document.getElementById('menu-page-info');
    const progressSectionExpanded = document.getElementById('progress-section-expanded');

    // AI Debater Elements
    const aiDebaterButtonCollapsed = document.getElementById('ai-debater-button-collapsed');
    const aiDebaterSection = document.getElementById('ai-debater-section');
    const aiChatMessages = document.getElementById('ai-chat-messages');
    const aiUserInput = document.getElementById('ai-user-input');
    const aiSendButton = document.getElementById('ai-send-button');
    const aiStatus = document.getElementById('ai-status');

    // Fullscreen Buttons
    const fullscreenButtonCollapsed = document.getElementById('fullscreen-button-collapsed');
    const fullscreenButtonExpanded = document.getElementById('fullscreen-button-expanded');
    
    // Highlight button (placeholder for now)
    const highlightButtonCollapsed = document.getElementById('highlight-button-collapsed');


    const overlayMobile = document.getElementById('overlay-mobile');

    // State Variables
    let bookContent = [];
    let pages = [];
    let currentPage = 0;
    let allRepositoryBooks = [];
    let currentlyLoadedBookTitle = null;
    let conversationHistory = []; // AI Debater chat history

    const localStorageBookPrefix = 'bookmark_book_';

    // --- Fullscreen API Helper Functions ---
    function isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    }

    function requestFullscreen(element) {
        if (element.requestFullscreen) element.requestFullscreen();
        else if (element.webkitRequestFullscreen) element.webkitRequestFullscreen();
        else if (element.msRequestFullscreen) element.msRequestFullscreen();
        else if (element.mozRequestFullScreen) element.mozRequestFullScreen();
    }

    function exitFullscreen() {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    }

    function toggleFullscreen() {
        if (!isFullscreen()) requestFullscreen(document.documentElement);
        else exitFullscreen();
    }
    
    function updateFullscreenButtonState() {
        const fsBtnCollapsed = fullscreenButtonCollapsed?.querySelector('button');
        const fsBtnExpanded = fullscreenButtonExpanded;
        const inFs = isFullscreen();
        if (fsBtnCollapsed) {
            fsBtnCollapsed.innerHTML = inFs ? "&#x26F7;" : "&#x26F6;"; // Exit : Enter
            fsBtnCollapsed.title = inFs ? "Exit Fullscreen" : "Toggle Fullscreen";
        }
        if (fsBtnExpanded) fsBtnExpanded.textContent = inFs ? "Exit Fullscreen" : "Toggle Fullscreen";
    }


    // --- Local Storage & Book Management ---
    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = { title: title, markdown: markdownText, lastPage: currentPage };
            localStorage.setItem(localStorageBookPrefix + title, JSON.stringify(bookData));
            listSavedBooks();
        } catch (e) {
            console.error("LS Save Error:", e);
            loadingStatus.textContent = "Warning: Could not save book to local storage.";
        }
    }

    function loadBookFromLocalStorage(title) {
        try {
            const item = localStorage.getItem(localStorageBookPrefix + title);
            if (item) {
                const bookData = JSON.parse(item);
                loadContent(bookData.markdown, bookData.lastPage, bookData.title, false); 
                addRecentBook({ title: bookData.title, url: null });
                return true;
            }
        } catch (e) { console.error(`LS Load Error for "${title}":`, e); }
        return false;
    }

    function listSavedBooks() {
        if (!savedBooksList) return;
        savedBooksList.innerHTML = ''; const books = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(localStorageBookPrefix)) {
                try {
                    const bookData = JSON.parse(localStorage.getItem(key));
                    if (bookData && bookData.title && bookData.markdown) books.push({ key: key, title: bookData.title });
                } catch (e) { console.error(`LS Parse Error for key: ${key}`, e); }
            }
        }
        if (books.length > 0) {
            books.forEach(book => {
                const li = document.createElement('li'); li.textContent = book.title; li.dataset.key = book.key;
                li.addEventListener('click', () => loadBookFromLocalStorage(book.key.replace(localStorageBookPrefix, '')));
                savedBooksList.appendChild(li);
            });
            if (clearSavedBooksButton) clearSavedBooksButton.style.display = 'block';
            if (savedBooksSection) savedBooksSection.style.display = 'block';
        } else {
            savedBooksList.innerHTML = '<li>No locally saved books found.</li>';
            if (clearSavedBooksButton) clearSavedBooksButton.style.display = 'none';
            if (savedBooksSection) savedBooksSection.style.display = 'none';
        }
    }

    function clearSavedBooks() {
        if (confirm('Are you sure you want to clear all locally saved books?')) {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key.startsWith(localStorageBookPrefix)) localStorage.removeItem(key);
            }
            listSavedBooks();
            if (!currentlyLoadedBookTitle || !localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
                showLoadingScreenInterface();
            }
        }
    }

    function addRecentBook(book) {
        let recentBooks = getRecentBooks();
        const isAlreadyRecent = recentBooks.some(rb => (book.url && rb.url === book.url) || (!book.url && rb.title === book.title));
        if (!isAlreadyRecent) {
            recentBooks.unshift({ title: book.title, url: book.url });
            localStorage.setItem('recentBooks', JSON.stringify(recentBooks.slice(0, 20)));
            listRecentBooks();
        }
    }

    function getRecentBooks() { return JSON.parse(localStorage.getItem('recentBooks') || '[]'); }

    function listRecentBooks() {
        if (!recentBooksList) return;
        recentBooksList.innerHTML = ''; const recentBooks = getRecentBooks();
        if (recentBooks.length > 0) {
            recentBooks.forEach(book => {
                const li = document.createElement('li'); li.textContent = book.title;
                li.dataset.url = book.url; li.dataset.title = book.title;
                li.addEventListener('click', () => book.url ? loadBookFromURL(book.url, book.title) : loadBookFromLocalStorage(book.title));
                recentBooksList.appendChild(li);
            });
            if (clearRecentBooksButton) clearRecentBooksButton.style.display = 'block';
        } else {
            recentBooksList.innerHTML = '<li>No recent files.</li>';
            if (clearRecentBooksButton) clearRecentBooksButton.style.display = 'none';
        }
    }

    function clearRecentBooks() {
        if (confirm('Are you sure you want to clear your recent files list?')) {
            localStorage.removeItem('recentBooks'); listRecentBooks();
        }
    }

    // --- Appearance Settings ---
    function setTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme', 'system-theme');
        document.body.classList.add(theme === 'system' ? 'system-theme' : `${theme}-theme`);
        localStorage.setItem('theme', theme);
    }

    function applySavedTheme() {
        const savedTheme = localStorage.getItem('theme') || 'system';
        const radio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
        if (radio) radio.checked = true;
        setTheme(savedTheme);
    }

    function setJustifyText(justify) {
        if (!bookContainer) return;
        bookContainer.classList.toggle('text-justify', justify);
        localStorage.setItem('justifyText', justify);
        if (bookContent.length > 0) { pages = paginateContent(bookContent); renderPage(currentPage); }
    }

    function applySavedJustification() {
        if (!justifyTextCheckbox) return;
        const savedJustify = localStorage.getItem('justifyText') === 'true';
        justifyTextCheckbox.checked = savedJustify;
        setJustifyText(savedJustify);
    }

    // --- Markdown Parsing ---
    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n'); const parsedContent = []; let currentBlock = '';
        function addBlock() {
            if (currentBlock.trim() !== '') {
                const trimmedBlock = currentBlock.trim();
                const italicBlockMatch = trimmedBlock.match(/^\_([^_]+)\_$/);
                if (italicBlockMatch && italicBlockMatch[1].trim().length > 0) {
                    parsedContent.push(`<em>${italicBlockMatch[1].trim().replace(/\n/g, '<br>')}</em>`);
                } else {
                    const sectionMatch = trimmedBlock.match(/^\*(\d+)\*\s*/);
                    if (sectionMatch) {
                        parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + trimmedBlock.substring(sectionMatch[0].length).trim().replace(/\n/g, '<br>'));
                    } else {
                        parsedContent.push(`<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`);
                    }
                }
                currentBlock = '';
            }
        }
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' && currentBlock.trim() !== '') addBlock();
            else if (line.startsWith('#')) { addBlock(); const level = line.match(/^#+/)[0].length; parsedContent.push(`<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`); }
            else if (line.startsWith('-------')) { addBlock(); parsedContent.push('<hr>'); }
            else if (trimmedLine !== '') {
                if (currentBlock !== '') currentBlock += '\n';
                currentBlock += line;
            }
        }
        addBlock();
        return parsedContent;
    }

    // --- Pagination ---
    function paginateContent(content) {
        if (!content || content.length === 0 || !pageLeft) return []; // Added !pageLeft check
        const bookPages = []; let currentPageContent = []; let currentPageHeight = 0;
        const isDesktop = window.innerWidth >= 768;
        const pagePadding = 20; const bookContainerPadding = 20;
        const sidebarCurrentWidth = isDesktop ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue(sideMenu.classList.contains('expanded') ? '--sidebar-width-expanded' : '--sidebar-width-collapsed')) : 0;
        const availableWidthForBook = window.innerWidth - sidebarCurrentWidth;
        const pageHeight = window.innerHeight - (bookContainerPadding * 2); // Nominal height for estimation
        let effectivePageWidth = (availableWidthForBook / (isDesktop ? 2 : 1)) - (pagePadding * 2) - (isDesktop ? 10 : 0);
        if (effectivePageWidth <=0) effectivePageWidth = 300; // Fallback if calculation is off (e.g. sidebar not measured yet)


        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            Object.assign(tempDiv.style, { 
                position: 'absolute', 
                visibility: 'hidden', 
                width: effectivePageWidth + 'px', 
                fontSize: getComputedStyle(pageLeft).fontSize || '1rem', // Use actual page font size
                lineHeight: getComputedStyle(pageLeft).lineHeight || '1.6', // Use actual page line height
                fontFamily: getComputedStyle(pageLeft).fontFamily || 'serif', // Use actual page font family
                padding: '0', 
                margin: '0',
                boxSizing: 'border-box'
            });
            // Apply specific margins from CSS more accurately if possible, or keep general heuristic
            if (elementHTML.startsWith('<h1')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<h2') || elementHTML.startsWith('<h3')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<span class="section-number">')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<em>')) { tempDiv.style.marginTop = '0'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML === '<hr>') { tempDiv.style.marginTop = '1em'; tempDiv.style.marginBottom = '1em'; }
            
            if (justifyTextCheckbox && justifyTextCheckbox.checked && elementHTML.startsWith('<p>')) tempDiv.style.textAlign = 'justify';
            
            tempDiv.innerHTML = elementHTML; 
            document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height; 
            document.body.removeChild(tempDiv);
            return height + 1; // Add a small buffer
        }

        for (const block of content) {
            const blockHeight = estimateHeight(block);
            if (currentPageHeight + blockHeight > pageHeight + 1 && currentPageContent.length > 0) { // +1 buffer for rounding
                bookPages.push(currentPageContent); 
                currentPageContent = [block]; 
                currentPageHeight = blockHeight;
            } else {
                currentPageContent.push(block); 
                currentPageHeight += blockHeight;
            }
        }
        if (currentPageContent.length > 0) bookPages.push(currentPageContent);
        return bookPages;
    }

    // --- Render Pages & Update Progress ---
    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;
        const totalBookPages = pages.length;
        let currentSimpleProgressPage = 0;


        if (menuPageInfo && progressSectionExpanded && simplePageInfo && verticalBookTitleText && collapsedBookTitleDiv && collapsedProgressDiv) {
            if (totalBookPages > 0) {
                const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
                const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, totalBookPages) : pageIndex + 1;
                const progressTextExpandedContent = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${totalBookPages}`;
                menuPageInfo.textContent = progressTextExpandedContent;
                
                // Visibility of progressSectionExpanded is now primarily handled by toggleMenu
                if (!sideMenu.classList.contains('expanded')) {
                    progressSectionExpanded.style.display = 'block';
                } else {
                    progressSectionExpanded.style.display = 'none';
                }

                currentSimpleProgressPage = isDesktop ? displayPageStart : displayPageStart;
                simplePageInfo.innerHTML = `${currentSimpleProgressPage}<br>---<br>${totalBookPages}`;
                verticalBookTitleText.textContent = currentlyLoadedBookTitle || "Book Title";
                collapsedBookTitleDiv.style.display = 'block';
                collapsedProgressDiv.style.display = 'block';
            } else {
                menuPageInfo.textContent = "Page 0 of 0"; 
                progressSectionExpanded.style.display = 'none';
                simplePageInfo.innerHTML = "0<br>---<br>0";
                verticalBookTitleText.textContent = "";
                collapsedBookTitleDiv.style.display = 'none'; 
                collapsedProgressDiv.style.display = 'none';
            }
        }


        if (pageLeft) pageLeft.innerHTML = '';
        if (pageRight) pageRight.innerHTML = '';

        if (isDesktop) {
            const leftIdx = pageIndex * 2, rightIdx = pageIndex * 2 + 1;
            if (pages[leftIdx] && pageLeft) pageLeft.innerHTML = pages[leftIdx].join('');
            if (pages[rightIdx] && pageRight) pageRight.innerHTML = pages[rightIdx].join('');
        } else {
            if (pages[pageIndex] && pageLeft) pageLeft.innerHTML = pages[pageIndex].join('');
        }
        if (pageLeft) pageLeft.scrollTop = 0;
        if (pageRight) pageRight.scrollTop = 0;

        if (bookContent.length > 0 && currentlyLoadedBookTitle && localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
            try {
                const item = localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle);
                if (item) {
                    const bookData = JSON.parse(item); bookData.lastPage = currentPage;
                    localStorage.setItem(localStorageBookPrefix + currentlyLoadedBookTitle, JSON.stringify(bookData));
                }
            } catch (e) { console.error("LS page save error:", e); }
        }
    }

    // --- Navigation ---
    function nextPage() {
        const isDesktop = window.innerWidth >= 768;
        const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
        if (currentPage < totalPageSets - 1) { currentPage++; renderPage(currentPage); }
    }

    function prevPage() {
        if (currentPage > 0) { currentPage--; renderPage(currentPage); }
    }

    // --- Menu Toggling ---
    function toggleMenu(forceState) {
        const isDesktop = window.innerWidth >= 768;
        const currentlyExpanded = sideMenu.classList.contains('expanded');
        const expand = forceState !== undefined ? forceState : !currentlyExpanded;

        sideMenu.classList.toggle('expanded', expand);
        document.body.classList.toggle('menu-expanded', expand);
        
        if (expandedMenuContent) expandedMenuContent.classList.toggle('hidden', !expand);
        
        if (isDesktop && collapsedSidebarContent) {
            collapsedSidebarContent.style.display = expand ? 'none' : 'flex';
        }

        if (!isDesktop) {
            if (overlayMobile) overlayMobile.classList.toggle('active', expand);
        }

        // Hide progress section when menu is expanded
        if (progressSectionExpanded) {
            if (expand) {
                progressSectionExpanded.style.display = 'none';
            }
            // When collapsing, the subsequent renderPage call will handle its visibility if a book is loaded.
        }
        
        const openingAIDebater = expand && aiDebaterButtonCollapsed && document.activeElement && aiDebaterButtonCollapsed.contains(document.activeElement);

        if (openingAIDebater) {
            if (aiDebaterSection) aiDebaterSection.style.display = 'block';
            // Ensure settings are collapsed for max AI debater space
            if (collapsibleSettingsContent && !collapsibleSettingsContent.classList.contains('hidden') && settingsArrow) {
                 collapsibleSettingsContent.classList.add('hidden');
                 settingsArrow.textContent = '►'; // Set arrow to collapsed state
            }
            if (aiUserInput) aiUserInput.focus();
        }
        
        if (bookContent.length > 0) {
            pages = paginateContent(bookContent);
            renderPage(currentPage); 
        }
    }


    // --- UI State Management ---
    function showLoadingScreenInterface() {
        if (loadingArea) loadingArea.style.display = 'block';
        if (bookContainer) bookContainer.style.display = 'none';
        if (sideMenu) sideMenu.style.display = 'none';
        document.body.classList.remove('book-loaded', 'menu-expanded');
        currentlyLoadedBookTitle = null;
        listSavedBooks(); listRecentBooks();
        if(collapsedBookTitleDiv) collapsedBookTitleDiv.style.display = 'none';
        if(collapsedProgressDiv) collapsedProgressDiv.style.display = 'none';
        if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'none';
        if (aiDebaterSection) aiDebaterSection.style.display = 'none';
        if (fullscreenButtonCollapsed) fullscreenButtonCollapsed.style.display = 'none';
        if (highlightButtonCollapsed) highlightButtonCollapsed.style.display = 'none';
        conversationHistory = [];
        if(aiChatMessages) aiChatMessages.innerHTML = '';
        updateFullscreenButtonState();
    }

    // --- Book Loading ---
    async function loadBookFromURL(url, title, initialPage = 0) {
        if (loadingStatus) loadingStatus.textContent = `Loading: ${title}...`;
        try {
            let markdownText;
            const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');
            if (isExternalUrl) {
                console.log(`Proxying external URL: ${url} with title hint: ${title}`);
                const proxyUrlPath = '/fetch-book';
                const proxyResponse = await fetch(`${proxyUrlPath}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
                if (!proxyResponse.ok) throw new Error(`Proxy error! (${proxyResponse.status}) ${await proxyResponse.text()}`);
                markdownText = await proxyResponse.text();
            } else {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
                markdownText = await response.text();
            }
            const isTxtSource = url.toLowerCase().endsWith('.txt');
            loadContent(markdownText, initialPage, title, isTxtSource);
            addRecentBook({ title: title, url: url });
        } catch (error) {
            console.error("Error loading book from URL:", error);
            if (loadingStatus) loadingStatus.textContent = `Error: ${error.message}`;
            showLoadingScreenInterface();
        }
    }
    
    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book', isTxtSource = false) {
        if (loadingStatus) loadingStatus.textContent = 'Parsing content...';
        let tempBookContent = parseMarkdown(markdownText);
        
        let hasH1 = tempBookContent.slice(0, 3).some(block => block.toLowerCase().startsWith('<h1>'));
        if (!hasH1 && title) {
            tempBookContent.unshift(`<h1>${title}</h1>`);
            console.log(`Fallback: Prepended H1 title ('${title}') from filename/repo as none was found.`);
        }
        
        bookContent = tempBookContent;
        currentlyLoadedBookTitle = title;
        if (loadingStatus) loadingStatus.textContent = 'Paginating content...';
        pages = paginateContent(bookContent);

        if (pages.length > 0) {
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
            if (loadingArea) loadingArea.style.display = 'none';
            if (bookContainer) bookContainer.style.display = 'flex';
            if (sideMenu) sideMenu.style.display = 'flex';
            document.body.classList.add('book-loaded');
            if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'block';
            if (fullscreenButtonCollapsed) fullscreenButtonCollapsed.style.display = 'block';
            if (highlightButtonCollapsed) highlightButtonCollapsed.style.display = 'block';
            if (loadingStatus) loadingStatus.textContent = '';
            if (sideMenu && sideMenu.classList.contains('expanded')) toggleMenu(false); // Collapse menu on new book load
             // Ensure settings are collapsed and arrow is correct when a new book loads and menu might be briefly visible
            if (collapsibleSettingsContent && settingsArrow) {
                collapsibleSettingsContent.classList.add('hidden');
                settingsArrow.textContent = '►';
            }
        } else {
            if (loadingStatus) loadingStatus.textContent = 'Could not process content or book empty.';
            showLoadingScreenInterface();
        }
        conversationHistory = [];
        if(aiChatMessages) aiChatMessages.innerHTML = '';
        if(aiStatus) aiStatus.textContent = '';
        if(aiDebaterSection) aiDebaterSection.style.display = 'none'; // Keep AI debater hidden initially
        updateFullscreenButtonState();
    }

    if (fileInput) {
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0]; if (!file) return;
            if (loadingStatus) loadingStatus.textContent = `Loading file: ${file.name}...`;
            const reader = new FileReader();
            reader.onload = (e) => {
                const title = file.name.replace(/\.(md|txt)$/i, '');
                const isTxtSource = file.name.toLowerCase().endsWith('.txt');
                loadContent(e.target.result, 0, title, isTxtSource);
                addRecentBook({ title: title, url: null });
            };
            reader.onerror = () => { if (loadingStatus) loadingStatus.textContent = 'Error loading file.'; };
            reader.readAsText(file);
        });
    }

    if (loadUrlButton) {
        loadUrlButton.addEventListener('click', () => {
            if (!urlInput) return;
            const url = urlInput.value.trim(); if (!url) { if (loadingStatus) loadingStatus.textContent = 'Please enter a URL.'; return; }
            const placeholderTitle = url.substring(url.lastIndexOf('/') + 1).replace(/\.(md|txt|markdown)$/i, '') || 'Book from URL';
            loadBookFromURL(url, placeholderTitle);
        });
    }


    async function fetchRepositoryBooks() {
        try {
            const response = await fetch('books_index.json');
            if (!response.ok) throw new Error('Book index not found or failed to load.');
            allRepositoryBooks = await response.json();
            renderRepositoryBooks(allRepositoryBooks);
        } catch (error) {
            console.error("Repo fetch error:", error);
            if (loadingArea) {
                const repoTitleEl = Array.from(loadingArea.querySelectorAll('.load-option h3')).find(h3 => h3.textContent.includes("Load from Repository"));
                if (repoTitleEl) repoTitleEl.textContent = 'Repository books not available.';
            }
            if (bookSearchInput) bookSearchInput.style.display = 'none';
            if (repositoryBooksList) repositoryBooksList.style.display = 'none';
        }
    }

    function renderRepositoryBooks(booksToRender) {
        if (!repositoryBooksList) return;
        repositoryBooksList.innerHTML = '';
        if (booksToRender.length > 0) {
            booksToRender.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} - ${book.author} (${book.year})`;
                li.dataset.url = book.url;
                li.dataset.title = book.title;
                li.addEventListener('click', () => loadBookFromURL(book.url, book.title));
                repositoryBooksList.appendChild(li);
            });
        } else {
            repositoryBooksList.innerHTML = '<li>No matching books found.</li>';
        }
    }
    function filterRepositoryBooks() {
        if (!bookSearchInput) return;
        const searchTerm = bookSearchInput.value.toLowerCase();
        const filteredBooks = allRepositoryBooks.filter(book => 
            book.title.toLowerCase().includes(searchTerm) || 
            book.author.toLowerCase().includes(searchTerm)
        );
        renderRepositoryBooks(filteredBooks);
    }

    // --- AI Debater ---
    function getSelectedTextOnPage() {
        let selectedText = "";
        if (window.getSelection) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let container = range.commonAncestorContainer;
                while (container) {
                    if (container.id === 'page-left' || container.id === 'page-right') {
                        selectedText = selection.toString().trim(); break;
                    }
                    container = container.parentNode;
                }
            }
        }
        return selectedText;
    }

    function getCurrentPageText() {
        let text = "";
        if (pageLeft && pageLeft.textContent) text += pageLeft.textContent + "\n\n";
        if (pageRight && pageRight.textContent && window.innerWidth >= 768) text += pageRight.textContent;
        return text.trim();
    }
    function addMessageToChat(text, sender) {
        if (!aiChatMessages) return;
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);
        messageDiv.textContent = text; 
        aiChatMessages.appendChild(messageDiv);
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    }

    async function handleSendToAI() {
        if (!aiUserInput || !aiSendButton || !aiStatus) return;
        const userText = aiUserInput.value.trim();
        
        addMessageToChat(userText, 'user');
        aiUserInput.value = '';
        aiStatus.textContent = 'Book Debate Mate is thinking...';
        aiSendButton.disabled = true; aiUserInput.disabled = true;

        const selectedTextOnPage = getSelectedTextOnPage();
        const fullPageContext = getCurrentPageText();
        
        conversationHistory.push({ role: "user", content: userText }); 

        try {
            const response = await fetch('/api/debate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userMessage: userText,
                    selectedText: selectedTextOnPage,
                    fullPageContext: fullPageContext,
                    conversationHistory: conversationHistory 
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Server error: ${response.statusText}` }));
                throw new Error(`AI Error (${response.status}): ${errorData.message || "Unknown error from AI service."}`);
            }

            const aiResponse = await response.json();
            if (aiResponse.error) throw new Error(aiResponse.message || "AI returned an unspecified error.");
            
            addMessageToChat(aiResponse.reply, 'ai');
            conversationHistory.push({ role: "assistant", content: aiResponse.reply });
            aiStatus.textContent = '';

        } catch (error) {
            console.error("Error with AI Debater:", error);
            addMessageToChat(`Error: ${error.message}`, 'ai');
            aiStatus.textContent = 'Error communicating with AI.';
        } finally {
            aiSendButton.disabled = false; aiUserInput.disabled = false; if(aiUserInput) aiUserInput.focus();
        }
    }

    if (aiDebaterButtonCollapsed) {
        aiDebaterButtonCollapsed.addEventListener('click', () => {
            if (sideMenu && !sideMenu.classList.contains('expanded')) {
                 // Pass true to toggleMenu to force expansion and trigger specific AI debater UI setup
                toggleMenu(true);
            }
            if (aiDebaterSection) aiDebaterSection.style.display = 'block';

            // If settings are open, close them to maximize space for AI Debater
            if (collapsibleSettingsContent && !collapsibleSettingsContent.classList.contains('hidden') && settingsArrow) {
                collapsibleSettingsContent.classList.add('hidden');
                settingsArrow.textContent = '►';
            }

            if (conversationHistory.length === 0 && bookContent.length > 0 && aiChatMessages && aiChatMessages.children.length === 0) {
                const selected = getSelectedTextOnPage();
                addMessageToChat(selected ? `Let's discuss your selection: "${selected.substring(0,50)}..." What are your thoughts?` : "What aspect of the current page(s) would you like to debate or understand better?", 'ai');
            }
            if(aiUserInput) aiUserInput.focus();
        });
    }
    if (aiSendButton) aiSendButton.addEventListener('click', handleSendToAI);
    if (aiUserInput) aiUserInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToAI(); } });
    
    if (highlightButtonCollapsed?.querySelector('button')) {
        highlightButtonCollapsed.querySelector('button').addEventListener('click', () => {
            const selectedText = getSelectedTextOnPage();
            if (selectedText) {
                alert(`Highlight feature (WIP):\nSelected: "${selectedText}"\nThis would be saved to KV later.`);
            } else {
                alert("Please select some text on the page to highlight.");
            }
        });
    }

    // --- Event Listeners & Init ---
    document.addEventListener('keydown', (event) => {
        const isMenuExpanded = sideMenu && sideMenu.classList.contains('expanded');
        if (event.key === 'Escape') {
            if (isFullscreen()) { exitFullscreen(); event.preventDefault(); }
            else if (isMenuExpanded) { toggleMenu(false); event.preventDefault(); }
        } else if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) {
             // Check if the active element is not an input/textarea before page navigation
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
                return; 
            }
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') { nextPage(); event.preventDefault(); }
            else if (event.key === 'ArrowLeft') { prevPage(); event.preventDefault(); }
        }
    });

    if (themeRadios) themeRadios.forEach(radio => radio.addEventListener('change', (e) => setTheme(e.target.value)));
    if (justifyTextCheckbox) justifyTextCheckbox.addEventListener('change', (e) => setJustifyText(e.target.checked));
    
    if (fullscreenButtonCollapsed?.querySelector('button')) {
      fullscreenButtonCollapsed.querySelector('button').addEventListener('click', toggleFullscreen);
    }
    if (fullscreenButtonExpanded) fullscreenButtonExpanded.addEventListener('click', toggleFullscreen);
    
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(event =>
        document.addEventListener(event, updateFullscreenButtonState)
    );

    window.addEventListener('resize', () => {
        if (bookContent.length > 0) {
            if (overlayMobile && sideMenu) overlayMobile.classList.toggle('active', window.innerWidth < 768 && sideMenu.classList.contains('expanded'));
            pages = paginateContent(bookContent);
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(currentPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
        }
        updateFullscreenButtonState();
    });

    function init() {
        applySavedTheme(); 
        applySavedJustification();
        listSavedBooks(); 
        listRecentBooks(); 
        fetchRepositoryBooks();
        showLoadingScreenInterface(); 
        
        if (clearSavedBooksButton) clearSavedBooksButton.addEventListener('click', clearSavedBooks);
        if (clearRecentBooksButton) clearRecentBooksButton.addEventListener('click', clearRecentBooks);
        if (bookSearchInput) bookSearchInput.addEventListener('input', filterRepositoryBooks);
        
        if (menuToggle) {
            menuToggle.addEventListener('click', () => toggleMenu());
        }
        if (overlayMobile) {
            overlayMobile.addEventListener('click', () => toggleMenu(false));
        }

        // Collapsible settings listener
        if (settingsToggle && collapsibleSettingsContent && settingsArrow) {
            settingsToggle.addEventListener('click', () => {
                const isHidden = collapsibleSettingsContent.classList.contains('hidden');
                collapsibleSettingsContent.classList.toggle('hidden');
                settingsArrow.textContent = isHidden ? '▼' : '►';
            });
        }

        if (overlayMobile && window.innerWidth >= 768) overlayMobile.classList.remove('active');
    }

    init();
});