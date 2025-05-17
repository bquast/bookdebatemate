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
    const menuToggle = document.getElementById('menu-toggle'); // The hamburger icon itself
    const expandedMenuContent = document.getElementById('expanded-menu-content');

    // Collapsed Sidebar Specific Content
    const collapsedSidebarContent = document.getElementById('collapsed-sidebar-content');
    const collapsedBookTitleDiv = document.getElementById('collapsed-book-title');
    const verticalBookTitleText = document.getElementById('vertical-book-title-text');
    const collapsedProgressDiv = document.getElementById('collapsed-progress');
    const simplePageInfo = document.getElementById('simple-page-info'); // For "current---total"

    // Settings Elements in Expanded Menu
    const themeRadios = document.querySelectorAll('input[name="theme"]');
    const justifyTextCheckbox = document.getElementById('justify-text');
    const menuPageInfo = document.getElementById('menu-page-info'); // For "Page X-Y of Z" in expanded
    const progressSectionExpanded = document.getElementById('progress-section-expanded');

    // AI Debater Elements
    const aiDebaterButtonCollapsed = document.getElementById('ai-debater-button-collapsed');
    const aiDebaterSection = document.getElementById('ai-debater-section');
    const aiChatMessages = document.getElementById('ai-chat-messages');
    const aiUserInput = document.getElementById('ai-user-input');
    const aiSendButton = document.getElementById('ai-send-button');
    const aiStatus = document.getElementById('ai-status');

    const overlayMobile = document.getElementById('overlay-mobile'); // For mobile menu overlay

    // State Variables
    let bookContent = []; // Array of parsed HTML blocks (paragraphs, headings, etc.)
    let pages = [];       // Array of arrays, where each inner array is a page of HTML blocks
    let currentPage = 0;  // Current page index (0-based, refers to a "spread" on desktop)
    let allRepositoryBooks = []; // Full list from books_index.json
    let currentlyLoadedBookTitle = null; // Title of the currently loaded book
    let conversationHistory = []; // For AI Debater

    const localStorageBookPrefix = 'bookmark_book_';
    const localStorageRecentPrefix = 'bookmark_recent_'; // Not currently used, but good for differentiation

    // --- Local Storage Management (Explicitly Saved Books) ---
    function saveBookToLocalStorage(title, markdownText) {
        try {
            const bookData = { title: title, markdown: markdownText, lastPage: currentPage };
            localStorage.setItem(localStorageBookPrefix + title, JSON.stringify(bookData));
            listSavedBooks(); // Refresh the list
        } catch (e) {
            console.error("Failed to save book to local storage:", e);
            loadingStatus.textContent = "Warning: Could not save book to local storage.";
        }
    }

    function loadBookFromLocalStorage(title) {
        try {
            const item = localStorage.getItem(localStorageBookPrefix + title);
            if (item) {
                const bookData = JSON.parse(item);
                loadContent(bookData.markdown, bookData.lastPage, bookData.title);
                addRecentBook({ title: bookData.title, url: null }); // null URL for local
                return true;
            }
        } catch (e) { console.error(`Failed to load book "${title}" from local storage:`, e); }
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
                } catch (e) { console.error(`Error parsing saved book for key: ${key}`, e); }
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

    // --- Recent Files Management ---
    function addRecentBook(book) {
        let recentBooks = getRecentBooks();
        const isAlreadyRecent = recentBooks.some(recent => (book.url && recent.url === book.url) || (!book.url && recent.title === book.title));
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

    // --- Appearance Settings (Theme & Justification) ---
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
        if (bookContent.length > 0) { // Re-paginate if justification changes text flow
            pages = paginateContent(bookContent); renderPage(currentPage);
        }
    }

    function applySavedJustification() {
        const savedJustify = localStorage.getItem('justifyText') === 'true';
        justifyTextCheckbox.checked = savedJustify;
        setJustifyText(savedJustify); // Apply without re-paginating if no content yet
    }

    // --- Markdown Parsing ---
    function parseMarkdown(markdownText) {
        const lines = markdownText.split('\n'); const parsedContent = []; let currentBlock = '';
        function addBlock() {
            if (currentBlock.trim() !== '') {
                const trimmedBlock = currentBlock.trim(); // This block might contain multiple original lines
                const italicBlockMatch = trimmedBlock.match(/^\_([^_]+)\_$/); // Italic for whole block
                if (italicBlockMatch && italicBlockMatch[1].trim().length > 0) {
                    parsedContent.push(`<em>${italicBlockMatch[1].trim().replace(/\n/g, '<br>')}</em>`);
                } else {
                    const sectionMatch = trimmedBlock.match(/^\*(\d+)\*\s*/); // Section number
                    if (sectionMatch) {
                        parsedContent.push(`<span class="section-number">${sectionMatch[1]}</span>` + trimmedBlock.substring(sectionMatch[0].length).trim().replace(/\n/g, '<br>'));
                    } else {
                        // Default paragraph: wrap in <p>, convert internal newlines to <br>
                        parsedContent.push(`<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`);
                    }
                }
                currentBlock = '';
            }
        }
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine === '' && currentBlock.trim() !== '') { // An empty line signifies end of current block
                addBlock();
            } else if (line.startsWith('#')) { addBlock(); const level = line.match(/^#+/)[0].length; parsedContent.push(`<h${level}>${line.replace(/^#+\s*/, '')}</h${level}>`); }
            else if (line.startsWith('-------')) { addBlock(); parsedContent.push('<hr>'); }
            else if (trimmedLine !== '') { // Accumulate non-empty lines into currentBlock
                if (currentBlock !== '') currentBlock += '\n'; // Preserve original newlines within a block
                currentBlock += line;
            }
        }
        addBlock(); // Add the last block
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
        const pageHeight = window.innerHeight - (bookContainerPadding * 2); // Usable height for page content
        const pageWidth = (availableWidthForBook / (isDesktop ? 2 : 1)) - (pagePadding * 2) - (isDesktop ? 10 : 0); // Usable width (gap for desktop)

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
            return height + 1; // blockBuffer
        }
        for (const block of content) {
            const blockHeight = estimateHeight(block);
            if (currentPageHeight + blockHeight > pageHeight + 1 && currentPageContent.length > 0) { // Tolerance of 1px
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
        const totalBookPages = pages.length; // Actual number of internal pages

        if (totalBookPages > 0) {
            const displayPageStart = isDesktop ? (pageIndex * 2) + 1 : pageIndex + 1;
            const displayPageEnd = isDesktop ? Math.min((pageIndex * 2) + 2, totalBookPages) : pageIndex + 1;
            const progressTextExpanded = `Page ${displayPageStart}${isDesktop && displayPageEnd > displayPageStart ? '-' + displayPageEnd : ''} of ${totalBookPages}`;
            menuPageInfo.textContent = progressTextExpanded;
            progressSectionExpanded.style.display = 'block';

            const currentSimpleProgressPage = isDesktop ? displayPageStart : displayPageStart;
            simplePageInfo.innerHTML = `${currentSimpleProgressPage}<br>---<br>${totalBookPages}`;

            verticalBookTitleText.textContent = currentlyLoadedBookTitle || "Book Title";
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

        // Save current page to local storage for explicitly saved books
        if (bookContent.length > 0 && currentlyLoadedBookTitle && localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle)) {
            try {
                const item = localStorage.getItem(localStorageBookPrefix + currentlyLoadedBookTitle);
                if (item) {
                    const bookData = JSON.parse(item); bookData.lastPage = currentPage;
                    localStorage.setItem(localStorageBookPrefix + currentlyLoadedBookTitle, JSON.stringify(bookData));
                }
            } catch (e) { console.error("Failed to save current page to local storage:", e); }
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
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) { // Allow nav if menu collapsed or on mobile
            if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') { nextPage(); event.preventDefault(); }
            else if (event.key === 'ArrowLeft') { prevPage(); event.preventDefault(); }
        }
        if (event.key === 'Escape' && isMenuExpanded) toggleMenu(false); // Close menu with Escape
    });

    pageLeft.addEventListener('click', (event) => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) {
            if (window.innerWidth >= 768) { // Desktop: click left half for prev, right half for next
                if (event.clientX < pageLeft.getBoundingClientRect().left + pageLeft.offsetWidth / 2) prevPage();
                else nextPage();
            } else { prevPage(); } // Mobile: any click on left page is prev
        }
    });
    pageRight.addEventListener('click', () => {
        const isMenuExpanded = sideMenu.classList.contains('expanded');
        if (bookContent.length > 0 && (!isMenuExpanded || window.innerWidth < 768)) nextPage();
    });

    // --- UI State Management (Loading Screen vs. Book View) ---
    function showLoadingScreenInterface() {
        loadingArea.style.display = 'block'; bookContainer.style.display = 'none';
        sideMenu.style.display = 'none'; document.body.classList.remove('book-loaded', 'menu-expanded');
        currentlyLoadedBookTitle = null;
        listSavedBooks(); listRecentBooks();
        // Hide collapsed sidebar content specifically related to a loaded book
        collapsedBookTitleDiv.style.display = 'none';
        collapsedProgressDiv.style.display = 'none';
        if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'none'; // Hide AI button
        if (aiDebaterSection) aiDebaterSection.style.display = 'none'; // Hide AI chat
        conversationHistory = []; // Reset AI chat history
        if(aiChatMessages) aiChatMessages.innerHTML = ''; // Clear AI messages
    }

    // --- Book Loading ---
    async function loadBookFromURL(url, title, initialPage = 0) {
        loadingStatus.textContent = `Loading: ${title}...`;
        try {
            const response = await fetch(url); // Direct fetch
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            const arrayBuffer = await response.arrayBuffer();
            let markdownText;
            let detectedEncoding = 'utf-8';

            if (contentType) {
                const charsetMatch = contentType.match(/charset=([^;]+)/i);
                if (charsetMatch && charsetMatch[1]) {
                    const explicitCharset = charsetMatch[1].trim().toLowerCase();
                    if (['latin1', 'iso-8859-1', 'windows-1252', 'cp1252'].includes(explicitCharset)) {
                        detectedEncoding = 'iso-8859-1';
                    } else if (explicitCharset === 'utf-8' || explicitCharset === 'utf8') {
                        detectedEncoding = 'utf-8';
                    } else {
                        console.warn(`Unsupported charset: ${explicitCharset}. Trying fallback.`);
                        detectedEncoding = url.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
                    }
                } else if (url.endsWith('.txt')) {
                    console.log('No charset in Content-Type for .txt, assuming ISO-8859-1.');
                    detectedEncoding = 'iso-8859-1';
                }
            } else if (url.endsWith('.txt')) {
                console.log('No Content-Type header for .txt, assuming ISO-8859-1.');
                detectedEncoding = 'iso-8859-1';
            }
            console.log(`Attempting to decode with: ${detectedEncoding}`);
            try {
                const decoder = new TextDecoder(detectedEncoding, { fatal: true });
                markdownText = decoder.decode(arrayBuffer);
            } catch (e) {
                console.warn(`Failed to decode as ${detectedEncoding} (fatal): ${e.message}. Trying non-fatal UTF-8.`);
                const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
                markdownText = fallbackDecoder.decode(arrayBuffer);
                if (detectedEncoding !== 'iso-8859-1' && url.endsWith('.txt') && markdownText.includes('')) {
                     console.warn('UTF-8 fallback still problematic for .txt, trying non-fatal ISO-8859-1.');
                     const latin1FallbackDecoder = new TextDecoder('iso-8859-1', {fatal: false});
                     markdownText = latin1FallbackDecoder.decode(arrayBuffer);
                }
            }
            loadContent(markdownText, initialPage, title);
            addRecentBook({ title: title, url: url });
        } catch (error) {
            console.error("Error fetching markdown from URL:", error);
            loadingStatus.textContent = `Error: ${error.message}. Check console for CORS/network issues.`;
            showLoadingScreenInterface();
        }
    }

    function loadContent(markdownText, initialPage = 0, title = 'Untitled Book') {
        loadingStatus.textContent = 'Parsing content...'; bookContent = parseMarkdown(markdownText);
        currentlyLoadedBookTitle = title; // Set before pagination for title display
        loadingStatus.textContent = 'Paginating content...'; pages = paginateContent(bookContent);

        if (pages.length > 0) {
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(initialPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage); // This will also set the vertical book title via currentlyLoadedBookTitle
            loadingArea.style.display = 'none'; bookContainer.style.display = 'flex';
            sideMenu.style.display = 'flex'; document.body.classList.add('book-loaded');
            if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'block'; // Show AI button
            loadingStatus.textContent = '';
            if (sideMenu.classList.contains('expanded')) toggleMenu(false); // Collapse menu on new book load
        } else {
            loadingStatus.textContent = 'Could not process book content or book is empty.';
            menuPageInfo.textContent = "Page 0 of 0"; progressSectionExpanded.style.display = 'none';
            simplePageInfo.innerHTML = "0<br>---<br>0"; verticalBookTitleText.textContent = "";
            if (aiDebaterButtonCollapsed) aiDebaterButtonCollapsed.style.display = 'none';
            showLoadingScreenInterface(); // Revert to loading screen on failure
        }
        // Reset AI Debater state for new book
        conversationHistory = [];
        if(aiChatMessages) aiChatMessages.innerHTML = '';
        if(aiStatus) aiStatus.textContent = '';
        if(aiDebaterSection) aiDebaterSection.style.display = 'none'; // Hide AI chat section initially
    }

    // Event Listeners for Loading Books
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        loadingStatus.textContent = `Loading file: ${file.name}...`;
        const reader = new FileReader();
        reader.onload = (e) => {
            const title = file.name.replace(/\.md$/, '');
            loadContent(e.target.result, 0, title);
            addRecentBook({ title: title, url: null });
        };
        reader.onerror = () => loadingStatus.textContent = 'Error loading file.';
        reader.readAsText(file);
    });

    loadUrlButton.addEventListener('click', () => {
        const url = urlInput.value.trim(); if (!url) { loadingStatus.textContent = 'Please enter a URL.'; return; }
        const placeholderTitle = url.substring(url.lastIndexOf('/') + 1).replace(/\.(md|txt)$/, '') || 'Book from URL';
        loadBookFromURL(url, placeholderTitle);
    });

    // --- Repository Book List and Search ---
    async function fetchRepositoryBooks() {
        try {
            const response = await fetch('books_index.json');
            if (!response.ok) throw new Error('Failed to load book index');
            allRepositoryBooks = await response.json(); renderRepositoryBooks(allRepositoryBooks);
        } catch (error) {
            console.error("Error fetching repository book index:", error);
            const repoTitleEl = loadingArea.querySelector('.load-option h3'); // More robust selection
            if (repoTitleEl && repoTitleEl.textContent.includes("Load from Repository")) {
                repoTitleEl.textContent = 'Repository books not available.';
            }
            bookSearchInput.style.display = 'none'; repositoryBooksList.style.display = 'none';
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
        } else { repositoryBooksList.innerHTML = '<li>No books found matching your search.</li>'; }
    }

    function filterRepositoryBooks() {
        const searchTerm = bookSearchInput.value.toLowerCase();
        renderRepositoryBooks(allRepositoryBooks.filter(b => b.title.toLowerCase().includes(searchTerm) || b.author.toLowerCase().includes(searchTerm)));
    }

    // --- Menu Toggling (Right Sidebar) ---
    function toggleMenu(forceState) { // forceState can be true (expand) or false (collapse)
        const expand = forceState === undefined ? !sideMenu.classList.contains('expanded') : forceState;
        sideMenu.classList.toggle('expanded', expand);
        expandedMenuContent.classList.toggle('hidden', !expand); // Toggle visibility of expanded content
        document.body.classList.toggle('menu-expanded', expand);

        if (overlayMobile) { // Handle mobile overlay
            overlayMobile.classList.toggle('active', window.innerWidth < 768 && expand);
        }

        // Re-paginate because sidebar width changes affect page width calculation
        if (bookContent.length > 0) { pages = paginateContent(bookContent); renderPage(currentPage); }
    }

    menuToggle.addEventListener('click', () => toggleMenu());
    if (overlayMobile) {
        overlayMobile.addEventListener('click', () => { // Close menu if overlay is clicked on mobile
            if (sideMenu.classList.contains('expanded')) toggleMenu(false);
        });
    }

    // --- AI Debater Functions & Event Listeners ---
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
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('chat-message', sender);
        messageDiv.textContent = text;
        aiChatMessages.appendChild(messageDiv);
        aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
    }

    async function handleSendToAI() {
        const userText = aiUserInput.value.trim(); if (!userText) return;
        addMessageToChat(userText, 'user'); aiUserInput.value = '';
        aiStatus.textContent = 'AI is thinking...'; aiSendButton.disabled = true; aiUserInput.disabled = true;
        const currentPageContent = getCurrentPageText();
        conversationHistory.push({ role: "user", content: userText });

        const systemPrompt = `You are an AI Debater. The user is reading a book. Current section:\n---\n${currentPageContent}\n---\nExplain this section briefly and engage the user in a debate about it.`;

        try {
            // CONCEPTUAL: Replace with actual call to your Cloudflare Function for LLM
            console.log("Sending to conceptual AI Debater backend:", { systemPrompt, conversation: conversationHistory });
            // const response = await fetch('/api/ai-debater', { /* ... */ });
            // const aiResponse = await response.json();
            // addMessageToChat(aiResponse.reply, 'ai');
            // conversationHistory.push({ role: "assistant", content: aiResponse.reply });
            
            // Placeholder simulation:
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
            const mockReply = `Interesting point about "${userText.substring(0, 20)}...". Considering the context: "${currentPageContent.substring(0, 50)}...", what if we look at it from another perspective?`;
            addMessageToChat(mockReply, 'ai');
            conversationHistory.push({ role: "assistant", content: mockReply });
            aiStatus.textContent = '';
        } catch (error) {
            console.error("Error with AI Debater:", error);
            addMessageToChat(`Error: ${error.message || "Could not reach AI."}`, 'ai');
            aiStatus.textContent = 'Error communicating with AI.';
        } finally {
            aiSendButton.disabled = false; aiUserInput.disabled = false; aiUserInput.focus();
        }
    }

    if (aiDebaterButtonCollapsed) {
        aiDebaterButtonCollapsed.addEventListener('click', () => {
            if (!sideMenu.classList.contains('expanded')) toggleMenu(true);
            aiDebaterSection.style.display = 'block';
            if (conversationHistory.length === 0) { // Initial prompt or greeting
                 addMessageToChat("Let's discuss the current pages!", 'ai'); // Initial AI greeting
                 // Or trigger an initial analysis:
                 // conversationHistory.push({role: "user", content: "Please explain this current section."}); handleSendToAI();
            }
            aiUserInput.focus();
        });
    }
    if (aiSendButton) aiSendButton.addEventListener('click', handleSendToAI);
    if (aiUserInput) aiUserInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendToAI(); } });

    // --- Event Listeners for Settings & Resize ---
    themeRadios.forEach(radio => radio.addEventListener('change', (e) => setTheme(e.target.value)));
    justifyTextCheckbox.addEventListener('change', (e) => setJustifyText(e.target.checked));

    window.addEventListener('resize', () => {
        if (bookContent.length > 0) {
            if (overlayMobile) { // Manage mobile overlay visibility on resize
                overlayMobile.classList.toggle('active', window.innerWidth < 768 && sideMenu.classList.contains('expanded'));
            }
            pages = paginateContent(bookContent);
            const isDesktop = window.innerWidth >= 768;
            const totalPageSets = isDesktop ? Math.ceil(pages.length / 2) : pages.length;
            currentPage = Math.min(currentPage, totalPageSets > 0 ? totalPageSets - 1 : 0);
            renderPage(currentPage);
        }
    });

    // --- Initialization ---
    function init() {
        applySavedTheme(); applySavedJustification();
        listSavedBooks(); listRecentBooks(); fetchRepositoryBooks();
        showLoadingScreenInterface(); // Start with loading screen
        clearSavedBooksButton.addEventListener('click', clearSavedBooks);
        clearRecentBooksButton.addEventListener('click', clearRecentBooks);
        bookSearchInput.addEventListener('input', filterRepositoryBooks);
        if (overlayMobile && window.innerWidth >= 768) overlayMobile.classList.remove('active'); // Ensure mobile overlay is off on desktop init
    }

    init();
});