// functions/fetch-book.js

function extractTitleAuthorAndStripPreamble(text, titleHint) {
    let lines = text.split('\n');
    let extractedTitle = null;
    let extractedAuthor = null;
    let linesToRemoveIndices = new Set(); // Keep track of metadata lines to remove if not prepended

    // Stage 1: Extract Title and Author from initial lines
    // And also note their original line numbers
    const potentialMetadataBlock = lines.slice(0, 30); // Look in first 30 lines
    for (let i = 0; i < potentialMetadataBlock.length; i++) {
        const line = lines[i]; // Use original lines array for indexing
        const lineLower = line.toLowerCase().trim();
        if (lineLower.startsWith("title:")) {
            const titleValue = line.substring(lineLower.indexOf("title:") + "title:".length).trim();
            if (titleValue) {
                extractedTitle = titleValue;
                linesToRemoveIndices.add(i);
            }
        } else if (lineLower.startsWith("author:")) {
            const authorValue = line.substring(lineLower.indexOf("author:") + "author:".length).trim();
            if (authorValue) {
                extractedAuthor = authorValue;
                linesToRemoveIndices.add(i);
            }
        }
        // Add other metadata like Illustrator, Translator if needed, and add their indices to linesToRemoveIndices
        if (lineLower.startsWith("illustrator:") || lineLower.startsWith("translator:")) {
            linesToRemoveIndices.add(i);
        }
        // If we've found a title and author, and the next few lines are blank or clearly not content,
        // we might be done with the core metadata block.
        if (extractedTitle && extractedAuthor && (lineLower === "" || i > 10)) {
            // Heuristic: if title & author found early, subsequent blank lines might separate them from more boilerplate or content.
        }
    }

    // If no title extracted from content, use the hint
    if (!extractedTitle && titleHint) {
        extractedTitle = titleHint;
    }

    // Stage 2: Find the actual start of the book content, after all preamble
    let contentStartIndex = 0;
    const pgaLicenseMarker = "gutenberg.net.au/license.html";
    const genericPreambleEndMarkers = [
        "*** start of this project gutenberg ebook",
        "*** end of this project gutenberg ebook", // Some files have END too
        "*** start of the project gutenberg ebook",
        "*** end of the project gutenberg ebook",
        "* * * * *", // Common visual separator
        "----------------------------------------------------"
    ];
    const contentStartKeywords = [
        "chapter 1", "chapter i", "part one", "part i", "book one", "book i",
        "introduction", "prologue", "foreword", "preface", "contents", "table of contents"
    ];
    // Add the extracted title (if any) as a very strong content start marker
    if (extractedTitle && extractedTitle.length > 4) { // avoid short/generic matching
        contentStartKeywords.unshift(extractedTitle.toLowerCase());
    }

    let pgaLicenseLineNum = -1;
    for(let i=0; i < lines.length; ++i) {
        if (lines[i].toLowerCase().includes(pgaLicenseMarker)) {
            pgaLicenseLineNum = i;
            break;
        }
    }
    
    // If PGA license is found, assume preamble ends somewhere after it.
    // Try to find a clear content starter after the license.
    if (pgaLicenseLineNum !== -1) {
        for (let i = pgaLicenseLineNum + 1; i < lines.length; i++) {
            const lineTrimmedLower = lines[i].trim().toLowerCase();
            if (lineTrimmedLower === "") continue; // Skip blank lines

            // If one of the strong content start keywords is found after the license, use that.
            if (contentStartKeywords.some(marker => lineTrimmedLower.startsWith(marker))) {
                contentStartIndex = i;
                break;
            }
            // Heuristic: first non-empty line that is significantly different from typical boilerplate after license
            // This is harder to define generically. For now, we rely on keywords or title repetition.
            if (i > pgaLicenseLineNum + 5 && lineTrimmedLower.length > 0) { // Give some buffer after license
                 contentStartIndex = i; // Tentative start
                 break;
            }
        }
        if (contentStartIndex === 0) contentStartIndex = pgaLicenseLineNum + 1; // Fallback if no better found
    } else {
        // No PGA license found, try generic preamble enders or content starters
        for (let i = 0; i < lines.length; i++) {
            const lineTrimmedLower = lines[i].trim().toLowerCase();
             if (genericPreambleEndMarkers.some(marker => lineTrimmedLower.includes(marker))) {
                contentStartIndex = i + 1;
                break;
            }
            // If Title/Author was extracted, and we find them again in body, that's a good start
            if (extractedTitle && lineTrimmedLower === extractedTitle.toLowerCase() && i > Math.max(...linesToRemoveIndices, -1)) {
                 contentStartIndex = i; // This line IS the title, so include it
                 linesToRemoveIndices.add(i); // Mark this repeated title for removal from body if we already extracted it
                 // If author follows, mark that too
                 if (extractedAuthor && i+1 < lines.length && lines[i+1].trim().toLowerCase().startsWith(extractedAuthor.toLowerCase().substring(0,10))) {
                     linesToRemoveIndices.add(i+1);
                 }
                 break;
            }
            if (contentStartKeywords.some(marker => lineTrimmedLower.startsWith(marker)) && i > 10) { // Avoid matching title if it's also a contentStartKeyword too early
                contentStartIndex = i;
                break;
            }
             if (i > 200) { // Safety break
                 contentStartIndex = linesToRemoveIndices.size > 0 ? Math.max(...linesToRemoveIndices) + 1 : 0;
                 break;
             }
        }
    }

    // Ensure contentStartIndex is valid and skips initial blank lines
    while (contentStartIndex < lines.length && lines[contentStartIndex].trim() === "") {
        contentStartIndex++;
    }
    contentStartIndex = Math.min(contentStartIndex, lines.length);

    // Construct the final text
    // The body should be lines *not* in linesToRemoveIndices and *after or at* contentStartIndex
    // This is complex if metadata lines are interspersed.
    // Simpler: Take all lines from contentStartIndex. If extractedTitle/Author were part of *this* block
    // (i.e., contentStartIndex <= original line of title/author), they'll be duplicated.
    // Better: filter out linesToRemoveIndices *before* slicing by contentStartIndex, but this gets complex.

    // Let's try a different tack for body: rebuild it by excluding known metadata lines
    // and then taking from contentStartIndex. This is still not perfect if metadata appears *after* contentStart.
    // The most robust way: stripper identifies metadata, removes it from original lines, then finds contentStart in the *modified* lines.

    // New, simpler approach for body after contentStartIndex is found:
    // Assume contentStartIndex is the TRUE start of the narrative/chapter content.
    // The extractedTitle and extractedAuthor will be prepended.
    let body = lines.slice(contentStartIndex).join('\n');
    
    // If the first few lines of this 'body' are the title/author we already extracted, remove them to avoid duplication.
    if (extractedTitle) {
        const bodyStartsWithTitle = new RegExp(`^${extractedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\r?\n|$)`, 'i');
        if (bodyStartsWithTitle.test(body.substring(0, extractedTitle.length + 5))) { // Check first few chars
            body = body.replace(bodyStartsWithTitle, '').trimStart();
        }
    }
    if (extractedAuthor) {
         const bodyStartsWithAuthor = new RegExp(`^${extractedAuthor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\r?\n|$)`, 'i');
        if (bodyStartsWithAuthor.test(body.substring(0, extractedAuthor.length + 5))) {
             body = body.replace(bodyStartsWithAuthor, '').trimStart();
        }
    }


    let prependedHeader = "";
    if (extractedTitle) {
        prependedHeader += `# ${extractedTitle}\n`;
    }
    if (extractedAuthor) {
        prependedHeader += `## ${extractedAuthor}\n`;
    }
    if (prependedHeader) { // Add a blank line if we added a header
        prependedHeader += "\n";
    }

    console.log(`PGA/TXT Processed. Title: '${extractedTitle}', Author: '${extractedAuthor}'. Body starts from original line ~${contentStartIndex}.`);
    return prependedHeader + body;
}


// The rest of the onRequestGet function remains the same as provided in the previous full script.js,
// just ensure it calls this updated extractTitleAuthorAndStripPreamble function.
export async function onRequestGet(context) {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const bookUrl = requestUrl.searchParams.get('url');
    const bookTitleHint = requestUrl.searchParams.get('title'); // Get title hint if provided

    if (!bookUrl) return new Response('Missing URL', { status: 400 });

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) return new Response(`Workspace failed: ${response.status} ${response.statusText}`, { status: response.status });

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        let textContent;
        const finalEncoding = 'utf-8';
        let sourceEncoding = 'utf-8'; // Default

        if (contentType) {
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch && charsetMatch[1]) {
                const cs = charsetMatch[1].trim().toLowerCase();
                if (['latin1', 'iso-8859-1', 'windows-1252', 'cp1252'].includes(cs)) sourceEncoding = 'iso-8859-1';
                else if (cs === 'utf-8' || cs === 'utf8') sourceEncoding = 'utf-8';
                else {
                    console.warn(`Unsupported charset: ${cs} in Content-Type. Trying fallback.`);
                    sourceEncoding = bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
                }
            } else if (bookUrl.endsWith('.txt')) {
                 console.log('No charset in Content-Type for .txt, assuming ISO-8859-1.');
                sourceEncoding = 'iso-8859-1';
            }
        } else if (bookUrl.endsWith('.txt')) {
            console.log('No Content-Type header for .txt, assuming ISO-8859-1.');
            sourceEncoding = 'iso-8859-1';
        }
        
        console.log(`Decoding with: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            textContent = new TextDecoder(sourceEncoding, { fatal: true }).decode(arrayBuffer);
        } catch (e) {
            console.warn(`Fatal decode as ${sourceEncoding} failed: ${e.message}. Trying non-fatal UTF-8.`);
            textContent = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }

        // Process for preamble and title/author formatting
        if ((bookUrl.includes("gutenberg.net.au") || bookUrl.includes("archive.org/stream/")) && bookUrl.endsWith('.txt')) {
            textContent = extractTitleAuthorAndStripPreamble(textContent, bookTitleHint);
        }
        
        return new Response(textContent, { headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` } });
    } catch (error) {
        console.error('CF Function Error:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}