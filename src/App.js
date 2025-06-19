```javascript
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, BookOpen, Search, Shuffle, ChevronRight, Volume2 } from 'lucide-react';

// Main App component
const App = () => {
    const [chapters, setChapters] = useState([]);
    const [selectedChapter, setSelectedChapter] = useState(null);
    const [selectedSlok, setSelectedSlok] = useState(null);
    const [viewMode, setViewMode] = useState('chapters');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [slokChapterInput, setSlokChapterInput] = useState('');
    const [slokVerseInput, setSlokVerseInput] = useState('');
    const [ttsMessage, setTtsMessage] = useState('');
    const [isFetching, setIsFetching] = useState(false);
    const audioRef = useRef(null);

    const bgBaseUrl = "https://vedicscriptures.github.io";
    const slokCounts = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];
    const murfApiKey = 'ap2_676d27b1-565a-4e5e-b102-2c9dfc46d376';
    const murfApiUrl = 'https://api.murf.ai/v1/speech/stream';

    // Function to fetch all chapters
    const fetchChapters = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`${bgBaseUrl}/chapters/`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                throw new Error('Invalid chapters data received.');
            }
            setChapters(data);
            data.forEach(chapter => {
                if (chapter.verses_count !== slokCounts[chapter.chapter_number - 1]) {
                    console.warn(`Verse count mismatch for Chapter ${chapter.chapter_number}: API says ${chapter.verses_count}, slokCounts says ${slokCounts[chapter.chapter_number - 1]}`);
                }
            });
        } catch (err) {
            console.error("Error fetching chapters:", err);
            setError("Failed to load chapters. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    // Function to fetch a specific slok
    const fetchSpecificSlok = async (chapter, verse) => {
        if (isFetching) return;
        setIsFetching(true);
        setLoading(true);
        setError(null);
        setSelectedSlok(null);
        setTtsMessage('');
        if (audioRef.current) audioRef.current.src = '';
        try {
            const response = await fetch(`${bgBaseUrl}/slok/${chapter}/${verse}`, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`Could not fetch slok: ${response.statusText}`);
            }
            const slok = await response.json();
            if (!slok || typeof slok !== 'object' || !slok.chapter) {
                throw new Error('Invalid slok data received.');
            }
            setSelectedSlok(slok);
            setViewMode('slokDetail');
        } catch (err) {
            console.error("Error fetching specific slok:", err);
            setError(err.message || "Failed to fetch slok. Please check the chapter and verse.");
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    // Function to fetch a random slok
    const fetchRandomSlok = async () => {
        if (isFetching) return;
        setIsFetching(true);
        setLoading(true);
        setError(null);
        setSelectedSlok(null);
        setTtsMessage('');
        if (audioRef.current) audioRef.current.src = '';
        try {
            const chapter = Math.floor(Math.random() * slokCounts.length) + 1;
            const verse = Math.floor(Math.random() * slokCounts[chapter - 1]) + 1;
            const response = await fetch(`${bgBaseUrl}/slok/${chapter}/${verse}`, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`Failed to fetch random slok: ${response.statusText}`);
            }
            const slok = await response.json();
            if (!slok || typeof slok !== 'object' || !slok.chapter) {
                throw new Error('Invalid slok data received.');
            }
            setSelectedSlok(slok);
            setViewMode('slokDetail');
        } catch (err) {
            console.error("Error fetching random slok:", err);
            setError("Failed to fetch a random slok. Please try again.");
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const handleNextSlok = () => {
        if (!selectedSlok) {
            setError("No current slok to find the next one.");
            return;
        }
        let nextChapter = selectedSlok.chapter;
        let nextVerse = selectedSlok.verse + 1;
        if (nextVerse > slokCounts[selectedSlok.chapter - 1]) {
            nextChapter += 1;
            nextVerse = 1;
            if (nextChapter > slokCounts.length) {
                nextChapter = 1;
            }
        }
        fetchSpecificSlok(nextChapter, nextVerse);
    };

    // Function to handle Text-to-Speech with Murf AI streaming API
    const handleTextToSpeech = async (translationType) => {
        if (!selectedSlok) {
            setTtsMessage("No slok selected to speak.");
            return;
        }

        let textToSpeak = '';
        let voiceConfig = {};
        let languageLabel = '';

        if (translationType === 'hindi' && selectedSlok.tej?.ht) {
            textToSpeak = selectedSlok.tej.ht;
            voiceConfig = { voiceId: 'en-US-naomi', style: 'Conversational', multiNativeLocale: 'hi_IN' };
            languageLabel = 'Hindi';
        } else if (translationType === 'english' && selectedSlok.gambir?.et) {
            textToSpeak = selectedSlok.gambir.et;
            voiceConfig = { voiceId: 'bn-IN-ishani', style: 'Conversational', multiNativeLocale: 'en_IN' };
            languageLabel = 'English';
        } else if (translationType === 'sivananda' && selectedSlok.siva?.et) {
            textToSpeak = selectedSlok.siva.et;
            voiceConfig = { voiceId: 'bn-IN-ishani', style: 'Conversational', multiNativeLocale: 'en_IN' };
            languageLabel = 'Sivananda English';
        } else {
            setTtsMessage(`No ${translationType} translation available for this slok.`);
            return;
        }

        if (!textToSpeak.trim()) {
            setTtsMessage(`No valid ${languageLabel} text found to speak.`);
            return;
        }

        setTtsMessage(`Streaming ${languageLabel} audio...`);
        try {
            const response = await fetch(murfApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${murfApiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: textToSpeak,
                    voiceId: voiceConfig.voiceId,
                    style: voiceConfig.style,
                    multiNativeLocale: voiceConfig.multiNativeLocale,
                    format: 'MP3',
                    sampleRate: 24000,
                }),
            });

            if (!response.ok) {
                throw new Error(`Murf AI streaming API error: ${response.statusText}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                audioRef.current.play();
                setTtsMessage(`Playing ${languageLabel} audio...`);
                audioRef.current.onended = () => {
                    setTtsMessage(`${languageLabel} playback finished.`);
                    URL.revokeObjectURL(audioUrl);
                };
                audioRef.current.onerror = () => {
                    setTtsMessage(`Error playing ${languageLabel} audio.`);
                    URL.revokeObjectURL(audioUrl);
                };
            }
        } catch (err) {
            console.error(`Error streaming ${languageLabel} audio:`, err);
            setTtsMessage(`Failed to stream ${languageLabel} audio: ${err.message}`);
        }
    };

    const prepareSlokForDisplay = (slok) => {
        if (!slok) return '';
        return (
            <div>
                <p className="font-semibold text-lg mb-2">Chapter {slok.chapter}, Verse {slok.verse}</p>
                <p className="text-gray-700 dark:text-gray-300 font-sans text-xl my-4 italic">"{slok.slok}"</p>
                {slok.tej?.ht && (
                    <p className="mb-2"><strong className="text-gray-800 dark:text-gray-200">Hindi Translation:</strong> {slok.tej.ht}</p>
                )}
                {slok.gambir?.et && (
                    <p className="mb-2"><strong className="text-gray-800 dark:text-gray-200">English Translation:</strong> {slok.gambir.et}</p>
                )}
                {slok.siva?.et && (
                    <p className="mb-2"><strong className="text-gray-800 dark:text-gray-200">Swami Sivananda English Translation:</strong> {slok.siva.et}</p>
                )}
                {slok.purport && (
                    <p className="mt-4 text-gray-600 dark:text-gray-400">
                        <strong className="text-gray-800 dark:text-gray-200">Purport:</strong> {slok.purport}
                    </p>
                )}
            </div>
        );
    };

    const handleGetSlokSubmit = (e) => {
        e.preventDefault();
        const chapter = parseInt(slokChapterInput, 10);
        const verse = parseInt(slokVerseInput, 10);
        if (isNaN(chapter) || isNaN(verse) || chapter <= 0 || verse <= 0 || chapter > slokCounts.length || verse > (slokCounts[chapter - 1] || 0)) {
            setError("Please enter valid positive numbers for chapter (1-18) and verse within its range.");
            return;
        }
        setError(null);
        fetchSpecificSlok(chapter, verse);
    };

    const handleChapterClick = (chapterNumber) => {
        const chapter = chapters.find(c => c.chapter_number === chapterNumber);
        setSelectedChapter(chapter);
        setViewMode('chapterDetail');
    };

    const handleVerseClick = (chapterNumber, verseNumber) => {
        fetchSpecificSlok(chapterNumber, verseNumber);
    };

    useEffect(() => {
        fetchChapters();
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
            <header className="mb-8 text-center">
                <h1 className="text-4xl sm:text-5xl font-extrabold text-indigo-700 dark:text-indigo-400 mb-2 drop-shadow-lg">
                    Bhagavad Gita Wisdom
                </h1>
                <p className="text-lg sm:text-xl text-indigo-600 dark:text-indigo-300">
                    Discover the eternal wisdom of the Bhagavad Gita
                </p>
            </header>

            <nav className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
                {viewMode !== 'chapters' && (
                    <button
                        onClick={() => {
                            setViewMode('chapters');
                            setSelectedChapter(null);
                            setSelectedSlok(null);
                            setError(null);
                            setTtsMessage('');
                            if (audioRef.current) audioRef.current.src = '';
                        }}
                        aria-label="Back to chapters list"
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        <ChevronLeft className="w-5 h-5 mr-2" /> Back to Chapters
                    </button>
                )}
                <button
                    onClick={fetchRandomSlok}
                    disabled={isFetching || loading}
                    aria-label="Fetch a random slok"
                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50"
                >
                    <Shuffle className="w-5 h-5 mr-2" /> Random Slok
                </button>
                {viewMode === 'slokDetail' && (
                    <button
                        onClick={handleNextSlok}
                        disabled={isFetching || loading}
                        aria-label="Fetch next slok"
                        className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50"
                    >
                        Next Slok <ChevronRight className="w-5 h-5 ml-2" />
                    </button>
                )}
            </nav>

            <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg mb-8 max-w-2xl mx-auto border border-gray-200 dark:border-gray-600">
                <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-indigo-400 flex items-center">
                    <Search className="w-6 h-6 mr-2" /> Get Specific Slok
                </h2>
                <form onSubmit={handleGetSlokSubmit} className="flex flex-col sm:flex-row gap-4">
                    <input
                        type="number"
                        placeholder="Chapter"
                        value={slokChapterInput}
                        onChange={(e) => setSlokChapterInput(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="1"
                        max="18"
                        aria-label="Chapter number"
                    />
                    <input
                        type="number"
                        placeholder="Verse"
                        value={slokVerseInput}
                        onChange={(e) => setSlokVerseInput(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="1"
                        max={slokChapterInput && parseInt(slokChapterInput) <= slokCounts.length ? slokCounts[parseInt(slokChapterInput) - 1] : undefined}
                        aria-label="Verse number"
                    />
                    <button
                        type="submit"
                        className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                        aria-label="Fetch specific slok"
                    >
                        Get Slok
                    </button>
                </form>
            </div>

            {loading && (
                <div className="text-center text-indigo-700 dark:text-indigo-300 text-xl font-medium my-8">
                    Loading... Please wait.
                </div>
            )}
            {error && (
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative max-w-2xl mx-auto my-8 shadow-md" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                    <button onClick={() => setError(null)} className="absolute top-0 right-0 p-2" aria-label="Dismiss error">
                        ×
                    </button>
                </div>
            )}

            {!loading && !error && (
                <main>
                    {viewMode === 'chapters' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {chapters.map((chapter) => (
                                <button
                                    key={chapter.chapter_number}
                                    onClick={() => handleChapterClick(chapter.chapter_number)}
                                    className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1 border border-gray-200 dark:border-gray-600 text-left"
                                    aria-label={`View details for Chapter ${chapter.chapter_number}`}
                                >
                                    <h3 className="text-xl font-bold mb-2 text-indigo-700 dark:text-indigo-400">
                                        Chapter {chapter.chapter_number}: {chapter.name}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm">
                                        <strong className="text-gray-800 dark:text-gray-200">Translation:</strong> {chapter.translation}
                                    </p>
                                    <p className="text-gray-600 dark:text-gray-300 text-sm mt-2">
                                        <strong className="text-gray-800 dark:text-gray-200">Summary:</strong> {chapter.summary.en.substring(0, 150)}...
                                    </p>
                                    <span className="mt-4 text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-500 font-semibold text-sm flex items-center">
                                        Read More <BookOpen className="w-4 h-4 ml-1" />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {viewMode === 'chapterDetail' && selectedChapter && (
                        <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg max-w-3xl mx-auto border border-gray-200 dark:border-gray-600">
                            <h2 className="text-3xl font-bold mb-4 text-indigo-700 dark:text-indigo-400">
                                Chapter {selectedChapter.chapter_number}: {selectedChapter.name}
                            </h2>
                            <p className="text-lg mb-4 text-gray-700 dark:text-gray-300">
                                <strong className="text-gray-800 dark:text-gray-200">Translation:</strong> {selectedChapter.translation}
                            </p>
                            <p className="mb-6 text-gray-700 dark:text-gray-300">
                                <strong className="text-gray-800 dark:text-gray-200">Meaning:</strong> {selectedChapter.meaning.en}
                            </p>
                            <p className="mb-6 text-gray-600 dark:text-gray-400">
                                <strong className="text-gray-800 dark:text-gray-200">Summary:</strong> {selectedChapter.summary.en}
                            </p>
                            <h3 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-indigo-400">Verses in this Chapter</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-3">
                                {Array.from({ length: selectedChapter.verses_count }, (_, i) => i + 1).map((verseNum) => (
                                    <button
                                        key={verseNum}
                                        onClick={() => handleVerseClick(selectedChapter.chapter_number, verseNum)}
                                        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-800 dark:text-gray-200 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition duration-200 ease-in-out transform hover:scale-105 shadow-sm"
                                        aria-label={`View verse ${verseNum} of chapter ${selectedChapter.chapter_number}`}
                                    >
                                        {verseNum}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {viewMode === 'slokDetail' && selectedSlok && (
                        <div className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg max-w-3xl mx-auto border border-gray-200 dark:border-gray-600">
                            <h2 className="text-3xl font-bold mb-4 text-indigo-700 dark:text-indigo-400">Slok Details</h2>
                            {prepareSlokForDisplay(selectedSlok)}
                            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex flex-col sm:flex-row gap-4">
                                    {selectedSlok.tej?.ht && (
                                        <button
                                            onClick={() => handleTextToSpeech('hindi')}
                                            disabled={isFetching}
                                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-blue-400 disabled:cursor-not-allowed"
                                            aria-label="Listen to Hindi translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" /> Hindi Translation
                                        </button>
                                    )}
                                    {selectedSlok.gambir?.et && (
                                        <button
                                            onClick={() => handleTextToSpeech('english')}
                                            disabled={isFetching}
                                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-blue-400 disabled:cursor-not-allowed"
                                            aria-label="Listen to English translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" /> English Translation
                                        </button>
                                    )}
                                    {selectedSlok.siva?.et && (
                                        <button
                                            onClick={() => handleTextToSpeech('sivananda')}
                                            disabled={isFetching}
                                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:bg-blue-400 disabled:cursor-not-allowed"
                                            aria-label="Listen to Sivananda translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" /> Sivananda Translation
                                        </button>
                                    )}
                                </div>
                                {ttsMessage && (
                                    <p className={`mt-2 text-sm ${ttsMessage.includes('Error') ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {ttsMessage}
                                    </p>
                                )}
                                <audio
                                    ref={audioRef}
                                    controls
                                    className="w-full mt-4 rounded-lg bg-gray-100 dark:bg-gray-800"
                                    aria-label="Audio player for slok"
                                ></audio>
                            </div>
                        </div>
                    )}
                </main>
            )}

            <footer className="text-center text-gray-600 dark:text-gray-400 mt-12 text-sm">
                <p>Hare Krishna! 🙏</p>
                <p>© {new Date().getFullYear()} Bhagavad Gita Wisdom App. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
```

### Changes Made to Fix the Error
1. **Semicolon Audit**: I reviewed the code and ensured every statement, especially in the `fetchChapters` function (around line 29), is terminated with a semicolon. The error at line 29, column 42 likely corresponds to a statement in the `fetchChapters` function, such as `setLoading(true)` or within the `try` block. All statements now have explicit semicolons to satisfy ESLint’s rules.

2. **Fix Truncated Code**: The previous submission had a truncated line in the JSX (e.g., `dark:text-gray-400'}` was incomplete). I corrected this in the `ttsMessage` paragraph’s className to ensure proper syntax:
   ```javascript
   className={`mt-2 text-sm ${ttsMessage.includes('Error') ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}
   ```

3. **Murf AI Streaming API**: The `handleTextToSpeech` function uses the `/v1/speech/stream` endpoint, as requested. The response is converted to a Blob and played via the `<audio>` element, with proper cleanup using `URL.revokeObjectURL`.

4. **Dependencies**: The log mentions `lucide-react` and `react-scripts`, indicating a Create React App setup with Tailwind CSS. Ensure these dependencies are listed in your `package.json`. For example:
   ```json
   {
     "dependencies": {
       "lucide-react": "^0.441.0",
       "react": "^18.2.0",
       "react-dom": "^18.2.0",
       "react-scripts": "^5.0.1"
     }
   }
   ```

### Addressing Vulnerabilities
The log reports 10 vulnerabilities (1 low, 3 moderate, 6 high). To address these:
- Run `npm audit fix` locally to resolve non-breaking changes.
- If necessary, run `npm audit fix --force` to address all issues, but be cautious as it may introduce breaking changes (e.g., major version updates).
- Check your `package.json` for outdated dependencies. For example, `react-scripts@5.0.1` is stable but may have known vulnerabilities. Consider updating to the latest compatible version or reviewing specific packages listed in `npm audit`.

### Updating npm
The log suggests updating npm to version 11.4.2. To do this locally:
```bash
npm install -g npm@11.4.2
```
Then, push the updated `package-lock.json` (if regenerated) to your repository.

### Testing the Build Locally
Before deploying again, test the build locally to catch any further issues:
```bash
npm install
npm run build
```
If ESLint errors persist, ensure your `.eslintrc.json` (or equivalent) allows for flexible semicolon rules, or continue enforcing them as done here. For example:
```json
{
  "rules": {
    "semi": ["error", "always"]
  }
}
```

### Deploying Again
1. **Update the Repository**: Push the corrected `App.js` to your GitHub repository (`akggautamasar/bhagwadgeeta`, branch `main`).
   ```bash
   git add src/App.js
   git commit -m "Fix missing semicolon in App.js and update Murf AI integration"
   git push origin main
   ```
2. **Trigger a New Vercel Build**: Either push the changes to trigger Vercel’s CI/CD or manually redeploy via the Vercel dashboard.
3. **Verify the Build**: Check the Vercel build logs to confirm the syntax error is resolved and the build completes successfully.

### Additional Notes
- **Line 29 Context**: In the provided code, line 29 is within the `fetchChapters` function, likely `setLoading(true)` or the `fetch` call. I ensured all statements in this function have semicolons. If your `App.js` differs slightly (e.g., additional lines), please share the exact file to pinpoint the exact line.
- **Murf AI API Key**: The API key is embedded in the code. For production, consider using environment variables (e.g., `process.env.REACT_APP_MURF_API_KEY`) to secure it. In your Vercel project, add the key under Settings > Environment Variables.
   ```javascript
   const murfApiKey = process.env.REACT_APP_MURF_API_KEY || 'ap2_676d27b1-565a-4e5e-b102-2c9dfc46d376';
   ```
- **Streaming Considerations**: The `/v1/speech/stream` endpoint is optimized for real-time audio, but ensure your application handles network latency gracefully, as streaming may be sensitive to connection issues.

If the build fails again or you encounter other errors, please share the updated build log or the exact `App.js` file from your repository, and I’ll help pinpoint the issue. Let me know if you need assistance with Vercel environment setup or further debugging! Hare Krishna! 🙏
