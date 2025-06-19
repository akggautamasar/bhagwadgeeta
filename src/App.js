import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, BookOpen, Search, Shuffle, ChevronRight, Volume2 } from 'lucide-react'; // Importing icons, added Volume2 for TTS

// Main App component
const App = () => {
    // State variables for managing data and UI
    const [chapters, setChapters] = useState([]); // Stores the list of chapters
    const [selectedChapter, setSelectedChapter] = useState(null); // Stores the currently selected chapter for detailed view
    const [selectedSlok, setSelectedSlok] = useState(null); // Stores the currently selected slok details
    const [viewMode, setViewMode] = useState('chapters'); // Controls the current view: 'chapters', 'slokDetail', 'chapterDetail'
    const [loading, setLoading] = useState(true); // Manages loading state for API calls
    const [error, setError] = useState(null); // Stores any error messages
    const [slokChapterInput, setSlokChapterInput] = useState(''); // Input for specific slok chapter
    const [slokVerseInput, setSlokVerseInput] = useState(''); // Input for specific slok verse

    // Text-to-Speech specific states and ref
    const [isSpeaking, setIsSpeaking] = useState(false); // State for TTS loading
    const [ttsMessage, setTtsMessage] = useState(''); // Message for TTS status
    const [isFetching, setIsFetching] = useState(false); // State to prevent multiple concurrent API fetches
    const audioRef = useRef(null); // Ref for the audio player element

    // Base URL for the Bhagavad Gita API
    const bgBaseUrl = "https://vedicscriptures.github.io";
    
    // IMPORTANT: Updated TTS API URL to use the CORS proxy
    const TTS_API_BASE_URL = "https://text-to-speech.api-droid.workers.dev/";
    const CORS_PROXY_URL = "https://cors.hideme.eu.org/?url=";
    const TTS_API_URL = `${CORS_PROXY_URL}${encodeURIComponent(TTS_API_BASE_URL)}`; // Encode the actual API URL

    const slokCounts = [47, 72, 43, 42, 29, 47, 30, 28, 34, 42, 55, 20, 35, 27, 20, 24, 28, 78];

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

    // Function to fetch a specific slok by chapter and verse
    const fetchSpecificSlok = async (chapter, verse) => {
        if (isFetching) return; // Prevent multiple fetches
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
        if (isFetching) return; // Prevent multiple fetches
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

    // Function to handle Text-to-Speech conversion
    const handleTextToSpeech = async () => {
        if (!selectedSlok) {
            setTtsMessage("No slok selected to speak.");
            return;
        }
        
        let textToSpeak = '';
        // Prioritize English translation, then fall back to Sanskrit verse
        if (selectedSlok.gambir?.et) {
            textToSpeak = selectedSlok.gambir.et;
            setTtsMessage("Speaking English translation...");
        } else if (selectedSlok.slok) {
            textToSpeak = selectedSlok.slok;
            setTtsMessage("Speaking Sanskrit verse (may not sound ideal with Arabic voice)...");
        }
        
        if (!textToSpeak.trim()) {
            setTtsMessage("No valid text found to speak.");
            return;
        }

        setIsSpeaking(true);
        setTtsMessage("Generating speech...");

        try {
            if (audioRef.current) audioRef.current.src = ''; // Clear previous audio
            
            // Use the proxied TTS_API_URL
            const response = await fetch(TTS_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // The proxy handles the origin headers, so no need to specify extra ones
                },
                body: JSON.stringify({
                    text: textToSpeak,
                    sound: 'sound7' // Keep this based on your Python script
                })
            });

            if (!response.ok) {
                const errorResponse = await response.text();
                throw new Error(`TTS API request failed: ${response.status} ${response.statusText} - ${errorResponse}`);
            }

            const responseJson = await response.json();

            if (responseJson && "audioContent" in responseJson && typeof responseJson.audioContent === 'string') {
                const base64Audio = responseJson.audioContent;
                // Basic check for valid base64 structure (optional but good for robustness)
                if (!base64Audio.match(/^[A-Za-z0-9+/=]+$/)) {
                    throw new Error('Invalid base64 audio content format received.');
                }
                const audioUrl = `data:audio/mp3;base64,${base64Audio}`; 
                
                if (audioRef.current) {
                    audioRef.current.src = audioUrl;
                    audioRef.current.play().catch(err => {
                        // Catch potential DOMException for autoplay issues
                        setTtsMessage(`Audio playback failed: ${err.message}. Please try interacting with the page first.`);
                    });
                }
                setTtsMessage("Speech generated successfully! Playing audio.");
            } else {
                setTtsMessage("Audio data not found in the TTS response or invalid format.");
            }

        } catch (err) {
            console.error('Error in Text-to-Speech:', err);
            setTtsMessage(`Error generating speech: ${err.message}.`);
        } finally {
            setIsSpeaking(false);
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
                                <button
                                    onClick={handleTextToSpeech}
                                    disabled={isSpeaking || isFetching}
                                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Listen to slok audio"
                                >
                                    <Volume2 className="w-5 h-5 mr-2" />
                                    {isSpeaking ? 'Generating Audio...' : 'Listen to Slok'}
                                </button>
                                {ttsMessage && (
                                    <p className={`mt-2 text-sm ${ttsMessage.includes('Error') ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                                        {ttsMessage}
                                    </p>
                                )}
                                <audio ref={audioRef} controls className="w-full mt-4 rounded-lg bg-gray-100 dark:bg-gray-800" aria-label="Audio player for slok"></audio>
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
