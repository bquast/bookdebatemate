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

    const overlayMobile = document.getElementById('overlay-mobile');

    // State Variables
    let bookContent = [];
    let pages = [];
    let currentPage = 0;
    let allRepositoryBooks = [];
    let currentlyLoadedBookTitle = null;
    let conversationHistory = [];

    const localStorageBookPrefix = 'bookmark_book_';

    // --- Local Storage Management ---
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
                // For locally saved books, we don't know original source type easily.
                // Assume it's Markdown unless we store more metadata.
                // The title injection logic in loadContent will handle if it needs an H1.
                loadContent(bookData.markdown, bookData.lastPage, bookData.title, false); 
                addRecentBook({ title: bookData.title, url: null });
                return true;
            }
        } catch (e) { console.error(`LS Load Error for "${title}":`, e); }
        return false;
    }

    function listSavedBooks() {
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
            clearSavedBooksButton.style.display = 'block'; savedBooksSection.style.display = 'block';
        } else {
            savedBooksList.innerHTML = '<li>No locally saved books found.</li>';
            clearSavedBooksButton.style.display = 'none'; savedBooksSection.style.display = 'none';
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
        recentBooksList.innerHTML = ''; const recentBooks = getRecentBooks();
        if (recentBooks.length > 0) {
            recentBooks.forEach(book => {
                const li = document.createElement('li'); li.textContent = book.title;
                li.dataset.url = book.url; li.dataset.title = book.title;
                li.addEventListener('click', () => book.url ? loadBookFromURL(book.url, book.title) : loadBookFromLocalStorage(book.title));
                recentBooksList.appendChild(li);
            });
            clearRecentBooksButton.style.display = 'block';
        } else {
            recentBooksList.innerHTML = '<li>No recent files.</li>'; clearRecentBooksButton.style.display = 'none';
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
        bookContainer.classList.toggle('text-justify', justify);
        localStorage.setItem('justifyText', justify);
        if (bookContent.length > 0) { pages = paginateContent(bookContent); renderPage(currentPage); }
    }

    function applySavedJustification() {
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
        if (!content || content.length === 0) return [];
        const bookPages = []; let currentPageContent = []; let currentPageHeight = 0;
        const isDesktop = window.innerWidth >= 768;
        const pagePadding = 20; const bookContainerPadding = 20;
        const sidebarCurrentWidth = isDesktop ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue(sideMenu.classList.contains('expanded') ? '--sidebar-width-expanded' : '--sidebar-width-collapsed')) : 0;
        const availableWidthForBook = window.innerWidth - sidebarCurrentWidth;
        const pageHeight = window.innerHeight - (bookContainerPadding * 2);
        const pageWidth = (availableWidthForBook / (isDesktop ? 2 : 1)) - (pagePadding * 2) - (isDesktop ? 10 : 0);

        function estimateHeight(elementHTML) {
            const tempDiv = document.createElement('div');
            Object.assign(tempDiv.style, { position: 'absolute', visibility: 'hidden', width: pageWidth + 'px', fontSize: '1rem', lineHeight: '1.6', fontFamily: 'serif', padding: '0', margin: '0' });
            if (elementHTML.startsWith('<h1')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<h2') || elementHTML.startsWith('<h3')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '0.5em'; }
            else if (elementHTML.startsWith('<span class="section-number">')) { tempDiv.style.marginTop = '2.5em'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML.startsWith('<p>') || elementHTML.startsWith('<em>')) { tempDiv.style.marginTop = '0'; tempDiv.style.marginBottom = '1em'; }
            else if (elementHTML === '<hr>') { tempDiv.style.marginTop = '1em'; tempDiv.style.marginBottom = '1em'; }
            if (justifyTextCheckbox.checked && elementHTML.startsWith('<p>')) tempDiv.style.textAlign = 'justify';
            tempDiv.innerHTML = elementHTML; document.body.appendChild(tempDiv);
            const height = tempDiv.getBoundingClientRect().height; document.body.removeChild(tempDiv);
            return height + 1;
        }
        for (const block of content) {
            const blockHeight = estimateHeight(block);
            if (currentPageHeight + blockHeight > pageHeight + 1 && currentPageContent.length > 0) {
                bookPages.push(currentPageContent); currentPageContent = [block]; currentPageHeight = blockHeight;
            } else {
                currentPageContent.push(block); currentPageHeight += blockHeight;
            }
        }
        if (currentPageContent.length > 0) bookPages.push(currentPageContent);
        return bookPages;
    }

    // --- Render Pages & Update Progress ---
    function renderPage(pageIndex) {
        const isDesktop = window.innerWidth >= 768;
        const totalBookPages = pages.length;

        if (totalBookPages > 0) {
            const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
            const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, totalBookPages) : pageIndex + 1;
            const progressTextExpanded = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${totalBookPages}`;
            menuPageInfo.textContent = progressTextExpanded;
            progressSectionExpanded.style.display = 'block';
            const currentSimpleProgressPage = isDesktop ? displayPageStart : displayPageStart;
            simplePageInfo.innerHTML = `${currentSimpleProgressPage}<br>---<br>${totalBookPages}`;
            verticalBookTitleText.textContent = currentlyLoadedBookTitle || "Book Title"; // Use known title for sidebar
            collapsedBookTitleDiv.style.display = 'block';
            collapsedProgressDiv.style.display = 'block';
        } else {
            menuPageInfo.textContent = "Page 0 of 0"; progressSectionExpanded.style.display = 'none';
            simplePageInfo.innerHTML = "0<br>---<br>0";
            verticalBookTitleText.textContent = "";
            collapsedBookTitleDiv.style.display = 'none'; collapsedProgressDiv.style.display = 'none';
        }

        pageLeft.innerHTML = ''; pageRight.innerHTML = '';
        if (isDesktop) {
            const leftIdx = pageIndex * 2, rightIdx = pageIndex * 2 + 1;
            if (pages[leftIdx]) pageLeft.innerHTML = pages[leftIdx].join(''); else pageLeft.innerHTML = '';
            if (pages[rightIdx]) pageRight.innerHTML = pages[rightIdx].join(''); else pageRight.innerHTML = '';
        } else {
            if (pages[pageIndex]) pageLeft.innerHTML = pages[pageIndex].join(''); else pageLeft.innerHTML = '';
        }
        pageLeft.scrollTop = 0; pageRight.scrollTop = 0;

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

    document.addEventListener('keydown', (event) => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) {
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') { nextPage(); event.preventDefault(); }
            else if (event.key === 'ArrowLeft') { prevPage(); event.preventDefault(); }
        }
        if (event.key === 'Escape' && isMenuExpanded) toggleMenu(false);
    });

    pageLeft.addEventListener('click', (event) => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) {
            if (window.innerWidth >= 768) {
                if (event.clientX < pageLeft.getBoundingClientRect().left + pageLeft.offsetWidth / 2) prevPage();
                else nextPage();
            } else { prevPage(); }
        }
    });
    pageRight.addEventListener('click', () => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) nextPage();
    });

    // --- UI State Management ---
    function showLoadingScreenInterface() {
        loadingArea.style.display = 'block'; bookContainer.style.display = 'none';
        sideMenu.style.display = 'none'; document.body.classList.remove('book-loaded', 'menu-expanded');
        currentlyLoadedBookTitle = null;
        listSavedBooks(); listRecentBooks();
        collapsedBookTitleDiv.style.display = 'none';
        collapsedProgressDiv.style.display = 'none';
        if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'none';
        if (aiDebaterSection) aiDebaterSection.style.display = 'none';
        conversationHistory = [];
        if(aiChatMessages) aiChatMessages.innerHTML = '';
    }

    // --- Book Loading ---
    async function loadBookFromURL(url, title, initialPage = 0) {
        loadingStatus.textContent = `Loading: ${title}...`;
        try {
            let markdownText;
            const isExternalUrl = url.startsWith('http://') || url.startsWith('https://');

            if (isExternalUrl) {
                console.log(`Proxying external URL: ${url} with title hint: ${title}`);
                const proxyUrlPath = '/fetch-book'; // Ensure this path matches your CF function deployment
                const proxyResponse = await fetch(`${proxyUrlPath}?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`);
                
                if (!proxyResponse.ok) {
                    throw new Error(`Proxy error! Status: ${proxyResponse.status} - ${await proxyResponse.text()}`);
                }
                markdownText = await proxyResponse.text(); // CF function returns UTF-8
            } else { // Local relative URL (e.g. from books_index.json pointing to a local/repo file)
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
                markdownText = await response.text();
            }

            // Determine if the original source was likely a .txt file for title injection logic in loadContent
            const isTxtSource = url.toLowerCase().endsWith('.txt');
            loadContent(markdownText, initialPage, title, isTxtSource);
            addRecentBook({ title: title, url: url });

        } catch (error) {
            console.error("Error loading book from URL:", error);
            loadingStatus.textContent = `Error: ${error.message}`;
            showLoadingScreenInterface();
        }
    }
    
    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book', isTxtSource = false) {
        loadingStatus.textContent = 'Parsing content...';
        
        let tempBookContent = parseMarkdown(markdownText); // Text from CF function might already have # Title
        
        // Fallback Title Injection:
        // Only inject H1 from `title` (filename/repo title) if parseMarkdown 
        // didn't create an H1 from the content itself (e.g. CF function failed to add it, or it's an MD file without one).
        let hasH1 = tempBookContent.slice(0, 3).some(block => block.toLowerCase().startsWith('<h1>'));
        if (!hasH1 && title) {
            tempBookContent.unshift(`<h1>${title}</h1>`);
            console.log(`Fallback: Prepended H1 title ('${title}') as none was found in initial content.`);
        }
        
        bookContent = tempBookContent;
        currentlyLoadedBookTitle = title; // For sidebar display, always use the passed/known title
        loadingStatus.textContent = 'Paginating content...'; pages = paginateContent(bookContent);

        if (pages.length > 0) {
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
            loadingArea.style.display = 'none'; bookContainer.style.display = 'flex';
            sideMenu.style.display = 'flex'; document.body.classList.add('book-loaded');
            if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'block';
            loadingStatus.textContent = '';
            if (sideMenu.classList.contains('expanded')) toggleMenu(false);
        } else {
            loadingStatus.textContent = 'Could not process content or book is empty.';
            menuPageInfo.textContent = "Page 0 of 0"; progressSectionExpanded.style.display = 'none';
            simplePageInfo.innerHTML = "0<br>---<br>0"; verticalBookTitleText.textContent = "";
            if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'none';
            showLoadingScreenInterface();
        }
        conversationHistory = [];
        if(aiChatMessages) aiChatMessages.innerHTML = '';
        if(aiStatus) aiStatus.textContent = '';
        if(aiDebaterSection) aiDebaterSection.style.display = 'none';
    }

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        loadingStatus.textContent = `Loading file: ${file.name}...`;
        const reader = new FileReader();
        reader.onload = (e) => {
            const title = file.name.replace(/\.(md|txt)$/i, '');
            const isTxtSource = file.name.toLowerCase().endsWith('.txt');
            loadContent(e.target.result, 0, title, isTxtSource);
            addRecentBook({ title: title, url: null });
        };
        reader.onerror = () => loadingStatus.textContent = 'Error loading file.';
        reader.readAsText(file);
    });

    loadUrlButton.addEventListener('click', () => {
        const url = urlInput.value.trim(); if (!url) { loadingStatus.textContent = 'Please enter a URL.'; return; }
        const placeholderTitle = url.substring(url.lastIndexOf('/') + 1).replace(/\.(md|txt|markdown)$/i, '') || 'Book from URL';
        loadBookFromURL(url, placeholderTitle);
    });

    // --- Repository Book List and Search ---
    async function fetchRepositoryBooks() {
        try {
            const response = await fetch('books_index.json');
            if (!response.ok) throw new Error('Failed to load book index');
            allRepositoryBooks = await response.json(); renderRepositoryBooks(allRepositoryBooks);
        } catch (error) {
            console.error("Repo fetch error:", error);
            const repoTitleEl = Array.from(loadingArea.querySelectorAll('.load-option h3')).find(h3 => h3.textContent.includes("Load from Repository"));
            if (repoTitleEl) repoTitleEl.textContent = 'Repository books not available.';
            if (bookSearchInput) bookSearchInput.style.display = 'none';
            if (repositoryBooksList) repositoryBooksList.style.display = 'none';
        }
    }

    function renderRepositoryBooks(booksToRender) {
        repositoryBooksList.innerHTML = '';
        if (booksToRender.length > 0) {
            booksToRender.forEach(book => {
                const li = document.createElement('li');
                li.textContent = `${book.title} by ${book.author} (${book.year})`;
                li.dataset.url = book.url; li.dataset.title = book.title;
                li.addEventListener('click', () => loadBookFromURL(book.url, book.title));
                repositoryBooksList.appendChild(li);
            });
        } else { repositoryBooksList.innerHTML = '<li>No books found matching search.</li>'; }
    }

    function filterRepositoryBooks() {
        const searchTerm = bookSearchInput.value.toLowerCase();
        renderRepositoryBooks(allRepositoryBooks.filter(b => b.title.toLowerCase().includes(searchTerm) || b.author.toLowerCase().includes(searchTerm)));
    }

    // --- Menu Toggling ---
    function toggleMenu(forceState) {
        const expand = forceState === undefined ? !sideMenu.classList.contains('expanded') : forceState;
        sideMenu.classList.toggle('expanded', expand);
        expandedMenuContent.classList.toggle('hidden', !expand);
        document.body.classList.toggle('menu-expanded', expand);
        if (overlayMobile) overlayMobile.classList.toggle('active', window.innerWidth < 768 && expand);
        if (bookContent.length > 0) { pages = paginateContent(bookContent); renderPage(currentPage); }
    }

    menuToggle.addEventListener('click', () => toggleMenu());
    if (overlayMobile) {
        overlayMobile.addEventListener('click', () => { if (sideMenu.classList.contains('expanded')) toggleMenu(false); });
    }

    // --- AI Debater ---
    function getCurrentPageText() {
        let text = ""; const isDesktop = window.innerWidth >= 768;
        const leftPageIdx = isDesktop ? currentPage * 2 : currentPage;
        const leftPageContent = pages[leftPageIdx];
        if (leftPageContent) {
            const tempDiv = document.createElement('div'); tempDiv.innerHTML = leftPageContent.join('');
            text += (tempDiv.innerText || tempDiv.textContent || "") + "\n\n";
        }
        if (isDesktop) {
            const rightPageContent = pages[currentPage * 2 + 1];
            if (rightPageContent) {
                const tempDiv = document.createElement('div'); tempDiv.innerHTML = rightPageContent.join('');
                text += (tempDiv.innerText || tempDiv.textContent || "");
            }
        }
        return text.trim();
    }

    function addMessageToChat(text, sender) {
        if (!aiChatMessages) return; // Guard if element not found
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);
        messageDiv.textContent = text;
        aiChatMessages.appendChild(messageDiv);
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    }

    async function handleSendToAI() {
        if (!aiUserInput || !aiSendButton || !aiStatus) return; // Guard
        const userText = aiUserInput.value.trim(); if (!userText) return;
        addMessageToChat(userText, 'user'); aiUserInput.value = '';
        aiStatus.textContent = 'AI is thinking...'; aiSendButton.disabled = true; aiUserInput.disabled = true;
        const currentPageContent = getCurrentPageText();
        conversationHistory.push({ role: "user", content: userText });
        const systemPrompt = `You are an AI Debater. The user is reading a book. Current section:\n---\n${currentPageContent}\n---\nExplain this section briefly and engage the user in a debate about it.`;

        try {
            console.log("Sending to conceptual AI Debater backend:", { systemPrompt, conversation: conversationHistory });
            // const response = await fetch('/api/ai-debater', { /* ... */ }); // Real fetch call
            // const aiResponse = await response.json();
            // addMessageToChat(aiResponse.reply, 'ai');
            // conversationHistory.push({ role: "assistant", content: aiResponse.reply });
            await new Promise(resolve => setTimeout(resolve, 1200)); // Mock delay
            const mockReply = `Regarding "${userText.substring(0, 20)}...", in the context of "${currentPageContent.substring(0, 40)}...", what is your take on that?`;
            addMessageToChat(mockReply, 'ai');
            conversationHistory.push({ role: "assistant", content: mockReply });
            aiStatus.textContent = '';
        } catch (error) {
            console.error("AI Debater Error:", error);
            addMessageToChat(`Error: ${error.message || "Could not reach AI."}`, 'ai');
            aiStatus.textContent = 'Error with AI.';
        } finally {
            aiSendButton.disabled = false; aiUserInput.disabled = false; if(aiUserInput) aiUserInput.focus();
        }
    }

    if (aiDebaterButtonCollapsed) {
        aiDebaterButtonCollapsed.addEventListener('click', () => {
            if (!sideMenu.classList.contains('expanded')) toggleMenu(true);
            if (aiDebaterSection) aiDebaterSection.style.display = 'block';
            if (conversationHistory.length === 0 && bookContent.length > 0) { // Only prompt if book is loaded
                 addMessageToChat("Let's discuss the current page content!", 'ai');
            }
            if(aiUserInput) aiUserInput.focus();
        });
    }
    if (aiSendButton) aiSendButton.addEventListener('click', handleSendToAI);
    if (aiUserInput) aiUserInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToAI(); } });

    // --- Event Listeners & Init ---
    themeRadios.forEach(radio => radio.addEventListener('change', (e) => setTheme(e.target.value)));
    justifyTextCheckbox.addEventListener('change', (e) => setJustifyText(e.target.checked));

    window.addEventListener('resize', () => {
        if (bookContent.length > 0) {
            if (overlayMobile) overlayMobile.classList.toggle('active', window.innerWidth < 768 && sideMenu.classList.contains('expanded'));
            pages = paginateContent(bookContent);
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(currentPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
        }
    });

    function init() {
        applySavedTheme(); applySavedJustification();
        listSavedBooks(); listRecentBooks(); fetchRepositoryBooks();
        showLoadingScreenInterface();
        clearSavedBooksButton.addEventListener('click', clearSavedBooks);
        clearRecentBooksButton.addEventListener('click', clearRecentBooks);
        if (bookSearchInput) bookSearchInput.addEventListener('input', filterRepositoryBooks);
        if (overlayMobile && window.innerWidth >= 768) overlayMobile.classList.remove('active');
    }

    init();
});