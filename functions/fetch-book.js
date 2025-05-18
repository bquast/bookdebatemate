// functions/fetch-book.js

function processPgaText(text, titleHint) {
    let lines = text.split('\n');
    let extractedTitle = null;
    let extractedAuthor = null;
    let authorLineIndex = -1;
    let titleLineIndex = -1;

    // Find the *last* occurrences of Title: and Author: before a likely content start,
    // or within a reasonable header block. PGA often has them near the end of metadata.
    const contentStartKeywords = ["chapter 1", "chapter i", "part one", "part i", "book one", "book i", "prologue", "foreword", "preface", "introduction", (titleHint || "a^b^c").toLowerCase()];
    let possibleContentStartIndex = lines.length;

    for (let i = 0; i < lines.length; i++) {
        if (contentStartKeywords.some(marker => lines[i].trim().toLowerCase().startsWith(marker))) {
            possibleContentStartIndex = i;
            break;
        }
    }
    if (possibleContentStartIndex === lines.length && lines.length > 50) { // If no clear start, maybe it's just after ~30-50 lines of preamble
        possibleContentStartIndex = Math.min(50, lines.length);
         while (possibleContentStartIndex < lines.length && lines[possibleContentStartIndex].trim() === "") {
            possibleContentStartIndex++; // find next non-blank
        }
    }


    // Search for Title and Author backwards from the possible content start or from a max preamble search depth
    let searchLimit = Math.min(possibleContentStartIndex, 70); // Don't search too far back into the document

    for (let i = searchLimit -1; i >= 0; i--) {
        const line = lines[i];
        const lineLower = line.toLowerCase().trim();
        if (lineLower.startsWith("title:")) {
            const titleValue = line.substring(lineLower.indexOf("title:") + "title:".length).trim();
            if (titleValue && !extractedTitle) { // Take the last one found before content
                extractedTitle = titleValue;
                titleLineIndex = i;
            }
        } else if (lineLower.startsWith("author:")) {
            const authorValue = line.substring(lineLower.indexOf("author:") + "author:".length).trim();
            if (authorValue && !extractedAuthor) { // Take the last one found before content
                extractedAuthor = authorValue;
                authorLineIndex = i;
            }
        }
        if (extractedTitle && extractedAuthor) break; // Stop if both found
    }
    
    // If not found in the targeted block, try a broader search in the first few lines as a fallback
    if (!extractedTitle || !extractedAuthor) {
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase().trim();
            if (!extractedTitle && lineLower.startsWith("title:")) {
                 extractedTitle = line.substring(lineLower.indexOf("title:") + "title:".length).trim();
                 titleLineIndex = i;
            }
            if (!extractedAuthor && lineLower.startsWith("author:")) {
                 extractedAuthor = line.substring(lineLower.indexOf("author:") + "author:".length).trim();
                 authorLineIndex = i;
            }
        }
    }


    // If title still not found from content, use the hint from URL/filename
    if (!extractedTitle && titleHint) {
        extractedTitle = titleHint;
    }

    let bodyStartIndex = 0;
    if (authorLineIndex !== -1) {
        // Remove everything up to and including the Author line
        bodyStartIndex = authorLineIndex + 1;
    } else if (titleLineIndex !== -1) {
        // If only title was found, remove up to and including title line
        bodyStartIndex = titleLineIndex + 1;
    } else {
        // If neither, this means the structure is different. We might need to rely on possibleContentStartIndex
        // or a more generic preamble stripper. For PGA, this case should be rare if Title/Author are present.
        // For now, if no Title/Author identified in preamble to anchor removal, keep existing contentStartIndex logic
        bodyStartIndex = possibleContentStartIndex;
        console.warn("PGA process: Could not find clear Title/Author lines to anchor preamble removal. Relying on content start markers.");
    }
    
    // Ensure bodyStartIndex is valid and skips any leading blank lines from actual content
    while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim() === "") {
        bodyStartIndex++;
    }
    bodyStartIndex = Math.min(bodyStartIndex, lines.length);

    let body = lines.slice(bodyStartIndex).join('\n').trim();
    
    // Construct the Markdown header
    let prependedHeader = "";
    if (extractedTitle) {
        prependedHeader += `# ${extractedTitle.trim()}\n`;
    }
    if (extractedAuthor) {
        prependedHeader += `## ${extractedAuthor.trim()}\n`;
    }
    if (prependedHeader) {
        prependedHeader += "\n"; // Blank line after header
    }

    console.log(`PGA Processed. Using Title: '${extractedTitle}', Author: '${extractedAuthor}'. Body starts from effective line ~${bodyStartIndex +1}.`);
    return prependedHeader + body;
}

// Main onRequestGet function (remains the same as in the previous "full script" response)
export async function onRequestGet(context) {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const bookUrl = requestUrl.searchParams.get('url');
    const bookTitleHint = requestUrl.searchParams.get('title');

    if (!bookUrl) return new Response('Missing book URL parameter', { status: 400 });

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) return new Response(`Failed to fetch book: ${response.status} ${response.statusText}`, { status: response.status });

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        let textContent;
        const finalEncoding = 'utf-8';
        let sourceEncoding = 'utf-8';

        if (contentType) {
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch && charsetMatch[1]) {
                const cs = charsetMatch[1].trim().toLowerCase();
                if (['latin1', 'iso-8859-1', 'windows-1252', 'cp1252'].includes(cs)) sourceEncoding = 'iso-8859-1';
                else if (cs === 'utf-8' || cs === 'utf8') sourceEncoding = 'utf-8';
                else {
                    console.warn(`Unsupported charset in Content-Type: ${cs}. Assuming ${bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8'}.`);
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
        
        console.log(`Decoding with source encoding: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            textContent = new TextDecoder(sourceEncoding, { fatal: true }).decode(arrayBuffer);
        } catch (e) {
            console.warn(`Fatal decode as ${sourceEncoding} failed: ${e.message}. Trying non-fatal UTF-8 as fallback.`);
            textContent = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
        }

        // Specifically process for PGA .txt files using the new logic
        if (bookUrl.includes("gutenberg.net.au") && bookUrl.endsWith('.txt')) {
            console.log(`Applying PGA-specific processing for: ${bookUrl}`);
            textContent = processPgaText(textContent, bookTitleHint);
        } 
        // Optional: Add similar specific processing for archive.org if its preamble is different
        // else if (bookUrl.includes("archive.org/stream/") && bookUrl.endsWith('.txt')) {
        //     textContent = processArchiveOrgText(textContent, bookTitleHint); // A new function
        // }
        
        return new Response(textContent, { headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` } });
    } catch (error) {
        console.error('Cloudflare Function Error:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}