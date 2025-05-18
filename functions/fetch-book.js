// functions/fetch-book.js

function extractTitleAuthorAndStripPreamble(text, titleHint) {
    let lines = text.split('\n');
    let extractedTitle = titleHint || null;
    let extractedAuthor = null;
    let contentStartIndex = 0;

    // Try to find Title: and Author: in the first ~30 lines
    const metadataLinesToRemove = [];
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
        const lineLower = lines[i].toLowerCase().trim();
        if (lineLower.startsWith("title:")) {
            const titleValue = lines[i].substring(lineLower.indexOf("title:") + "title:".length).trim();
            if (titleValue) extractedTitle = titleValue;
            metadataLinesToRemove.push(i);
        } else if (lineLower.startsWith("author:")) {
            const authorValue = lines[i].substring(lineLower.indexOf("author:") + "author:".length).trim();
            if (authorValue) extractedAuthor = authorValue;
            metadataLinesToRemove.push(i);
        } else if (lineLower.startsWith("illustrator:")) { // Also common
             metadataLinesToRemove.push(i);
        } else if (extractedTitle && extractedAuthor && lineLower === "") { // Likely end of title/author block
            // If we found both and then a blank line, assume this is the end of that metadata.
            // Content might start on the next non-blank line.
            contentStartIndex = i + 1;
            break;
        }
    }
    
    // Remove identified metadata lines if we plan to prepend them differently
    // This is tricky if they are interspersed with other preamble.
    // For now, let's focus on finding the *true* start of content.

    let pgaLicenseFound = false;
    let potentialContentStartAfterLicense = -1;
    const preambleEndKeywords = [ // More generic "end of header" type lines
        "*** start of this project gutenberg ebook",
        "*** start of the project gutenberg ebook",
        "* * * * *", // Common separator
        "----------------------------------------------------" // Another separator
    ];
     const contentStartMarkers = [ // Things that signify actual book content
        extractedTitle ? extractedTitle.toLowerCase() : "a^b^c", // Use extracted title if found
        "part one", "part i", "chapter 1", "chapter i", "book one", "book i", "introduction",
        "contents", "table of contents"
    ];


    for (let i = 0; i < lines.length; i++) {
        const lineTrimmed = lines[i].trim();
        const lineLower = lineTrimmed.toLowerCase();

        if (preambleEndKeywords.some(keyword => lineLower.includes(keyword))) {
            contentStartIndex = i + 1;
            break; 
        }
        if (lineLower.includes("gutenberg.net.au/license.html")) {
            pgaLicenseFound = true;
            potentialContentStartAfterLicense = i + 2; // Look for content after this
        }

        // If we are past the typical metadata block OR past where the license was found
        if (i > (metadataLinesToRemove.length > 0 ? Math.max(...metadataLinesToRemove) +1 : 10) || (pgaLicenseFound && i >= potentialContentStartAfterLicense)) {
            if (lineTrimmed !== "") { // Consider first non-blank line as potential start
                 // More aggressively check if this line is a content marker
                if (contentStartMarkers.some(marker => lineLower.startsWith(marker) || lineTrimmed.startsWith(marker))) {
                    contentStartIndex = i;
                    break;
                }
                // If it's not a common preamble keyword, it might be the start
                const preambleKeywords = ["project gutenberg", "ebook no", "language:", "posted:", "updated:", "license", "contact", "transcriber's note", "editor's note", "illustration"];
                if (!preambleKeywords.some(pk => lineLower.includes(pk))) {
                    contentStartIndex = i;
                    break;
                }
            }
        }
         if (i > 200) { // Safety break for very long preambles
            if (potentialContentStartAfterLicense !== -1) {
                contentStartIndex = potentialContentStartAfterLicense;
            } else {
                // If title and author were found, assume content starts after them if nothing else found
                contentStartIndex = (metadataLinesToRemove.length > 0 ? Math.max(...metadataLinesToRemove) + 1 : 0);
            }
            console.warn("Preamble strip: Reached line limit or used fallback.");
            break;
        }
    }
    
    // Ensure contentStartIndex is not out of bounds
    while(contentStartIndex < lines.length && lines[contentStartIndex].trim() === "") {
        contentStartIndex++;
    }
    contentStartIndex = Math.min(contentStartIndex, lines.length);

    let body = lines.slice(contentStartIndex).join('\n');
    let header = "";

    if (extractedTitle) {
        header += `# ${extractedTitle}\n`;
    }
    if (extractedAuthor) {
        header += `## ${extractedAuthor}\n`;
    }
    if (header) {
        header += "\n"; // Add a blank line after the author
    }

    console.log(`Preamble stripped. Extracted Title: ${extractedTitle}, Author: ${extractedAuthor}. Content starting at original line ~${contentStartIndex + 1}`);
    return header + body;
}

export async function onRequestGet(context) {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const bookUrl = requestUrl.searchParams.get('url');
    const bookTitleHint = requestUrl.searchParams.get('title'); // From client

    if (!bookUrl) return new Response('Missing URL', { status: 400 });

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) return new Response(`Workspace failed: ${response.status}`, { status: response.status });

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
                else sourceEncoding = bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
            } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        
        console.log(`Decoding with: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            textContent = new TextDecoder(sourceEncoding, { fatal: true }).decode(arrayBuffer);
        } catch (e) {
            console.warn(`Fatal decode as ${sourceEncoding} failed. Trying non-fatal UTF-8.`);
            textContent = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }

        // For PGA .txt or Archive.org .txt files, try to extract metadata and strip preamble
        if ((bookUrl.includes("gutenberg.net.au") || bookUrl.includes("archive.org/stream/")) && bookUrl.endsWith('.txt')) {
            textContent = extractTitleAuthorAndStripPreamble(textContent, bookTitleHint);
        }
        
        return new Response(textContent, { headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` } });
    } catch (error) {
        console.error('CF Function Error:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}