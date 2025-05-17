// functions/fetch-book.js

function stripPgaPreamble(text, bookTitle) {
    const lines = text.split('\n');
    let contentStartIndex = 0;
    let foundPreambleEnd = false;

    // Keywords indicating the preamble or metadata section
    const preambleKeywords = [
        "project gutenberg of australia",
        "ebook no.:",
        "language:",
        "date first posted:",
        "date most recently updated:",
        "gutenberg.net.au/license.html",
        "to contact project gutenberg of australia",
        "copyright laws are changing",
        "this ebook is made available",
        "*transcriber's note*",
        "*etext editor's note*"
    ];

    // Markers that often indicate the start of the actual content
    const contentStartMarkers = [
        "*** start of the project gutenberg ebook", // Generic PG marker
        "*** start of this project gutenberg ebook",
        "part one",
        "part i",
        "chapter 1",
        "chapter i",
        "book one",
        "book i",
        "introduction"
        // Add bookTitle itself as a potential marker if it's distinct enough
    ];
    if (bookTitle && bookTitle.length > 5) { // Avoid very short/generic titles
        contentStartMarkers.unshift(bookTitle.toLowerCase());
    }


    let pgaLicenseFound = false;
    let potentialContentStartAfterLicense = -1;

    for (let i = 0; i < lines.length; i++) {
        const lineLower = lines[i].toLowerCase().trim();

        if (lineLower.includes("gutenberg.net.au/license.html")) {
            pgaLicenseFound = true;
            // Assume content starts a few lines after the license, or after a blank line
            potentialContentStartAfterLicense = i + 2; // Skip the line itself and maybe a contact line
            continue;
        }

        // If we've found the license, look for a clear break or content marker
        if (pgaLicenseFound && i >= potentialContentStartAfterLicense) {
            // After license, a few blank lines then title or chapter is common
            if (lineLower === "" && i + 1 < lines.length && lines[i+1].trim() !== "") {
                 // If current line is blank and next is not, it's a potential start
                 // Let's check if the next few lines are NOT preamble keywords
                let isStillPreamble = false;
                for(let j=1; j<=3 && (i+j < lines.length); j++) {
                    const nextLineLower = lines[i+j].toLowerCase().trim();
                    if (preambleKeywords.some(keyword => nextLineLower.includes(keyword))) {
                        isStillPreamble = true;
                        break;
                    }
                }
                if (!isStillPreamble) {
                    contentStartIndex = i + 1; // Start from the non-blank line
                    foundPreambleEnd = true;
                    break;
                }
            }
            // Check for explicit content start markers after the license
            if (contentStartMarkers.some(marker => lineLower.startsWith(marker))) {
                 // If the marker is the title itself, we might want to include this line
                contentStartIndex = i;
                foundPreambleEnd = true;
                break;
            }
        }

        // General check for content start markers (might catch earlier if license is missed)
        // Be careful with title match, as it might be in the preamble metadata too.
        // Only use title match if it's NOT also a preamble keyword line.
        let isPreambleLine = preambleKeywords.some(keyword => lineLower.includes(keyword));
        if (!isPreambleLine && contentStartMarkers.some(marker => lineLower.startsWith(marker))) {
            contentStartIndex = i;
            foundPreambleEnd = true;
            break;
        }


        // If we exceed a certain number of lines and haven't found an end, give up or use a less strict heuristic
        if (i > 200 && !foundPreambleEnd) { // Arbitrary limit for preamble length
            console.warn("PGA Preamble stripping: Reached line limit without definitive content start.");
            // Fallback: if license was found, use that position.
            if (potentialContentStartAfterLicense !== -1) {
                contentStartIndex = potentialContentStartAfterLicense;
                // Try to find the next non-empty line
                while(contentStartIndex < lines.length && lines[contentStartIndex].trim() === "") {
                    contentStartIndex++;
                }
            } else {
                 contentStartIndex = 0; // Default to not stripping if unsure
            }
            break;
        }
    }

    if (foundPreambleEnd) {
        console.log(`PGA Preamble stripped. Content starting at line: ${contentStartIndex + 1}`);
        // Sometimes the identified start line is something like "PART ONE", which we want to keep.
        // If the line *before* contentStartIndex is the book title, we might want to re-add it as H1.
        // For now, this just slices from contentStartIndex.
        return lines.slice(contentStartIndex).join('\n');
    } else if (potentialContentStartAfterLicense !== -1 && potentialContentStartAfterLicense < lines.length) {
        // Fallback if no clear marker but license was found
        console.log(`PGA Preamble stripped using license fallback. Content starting at line: ${potentialContentStartAfterLicense + 1}`);
        let finalStartIndex = potentialContentStartAfterLicense;
         while(finalStartIndex < lines.length && lines[finalStartIndex].trim() === "") {
            finalStartIndex++;
        }
        return lines.slice(finalStartIndex).join('\n');
    }

    console.log("PGA Preamble stripping: No clear end of preamble found, returning original text.");
    return text; // Return original if no clear marker found
}


export async function onRequestGet(context) {
    const { request } = context;
    const requestUrl = new URL(request.url);
    const bookUrl = requestUrl.searchParams.get('url');
    const bookTitleHint = requestUrl.searchParams.get('title'); // Get title hint if provided

    if (!bookUrl) {
        return new Response('Missing book URL parameter', { status: 400 });
    }

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) {
            return new Response(`Failed to fetch book: ${response.status} ${response.statusText}`, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        let textContent;
        const finalEncoding = 'utf-8';
        let sourceEncoding = 'utf-8';

        if (contentType) {
            const charsetMatch = contentType.match(/charset=([^;]+)/i);
            if (charsetMatch && charsetMatch[1]) {
                const explicitCharset = charsetMatch[1].trim().toLowerCase();
                if (['latin1', 'iso-8859-1', 'windows-1252', 'cp1252'].includes(explicitCharset)) {
                    sourceEncoding = 'iso-8859-1';
                } else if (explicitCharset === 'utf-8' || explicitCharset === 'utf8') {
                    sourceEncoding = 'utf-8';
                } else {
                    sourceEncoding = bookUrl.endsWith('.txt') ? 'iso-8859-1' : 'utf-8';
                }
            } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        } else if (bookUrl.endsWith('.txt')) sourceEncoding = 'iso-8859-1';
        
        console.log(`Decoding with: ${sourceEncoding} for URL: ${bookUrl}`);
        try {
            const decoder = new TextDecoder(sourceEncoding, { fatal: true });
            textContent = decoder.decode(arrayBuffer);
        } catch (e) {
            console.warn(`Failed to decode as ${sourceEncoding} (fatal). Trying non-fatal UTF-8.`);
            const fallbackDecoder = new TextDecoder('utf-8', { fatal: false });
            textContent = fallbackDecoder.decode(arrayBuffer);
        }

        // Attempt to strip PGA preamble for .txt files
        if (bookUrl.includes("gutenberg.net.au") && bookUrl.endsWith('.txt')) {
            textContent = stripPgaPreamble(textContent, bookTitleHint);
        }
        
        return new Response(textContent, {
            headers: { 'Content-Type': `text/plain; charset=${finalEncoding}` },
        });
    } catch (error) {
        console.error('Error in fetch-book function:', error);
        return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
}