import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, BookOpen, Search, Shuffle, ChevronRight, Volume2, Loader2 } from 'lucide-react';

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
    
    const [ttsMessage, setTtsMessage] = useState(''); // Unified message for TTS status/errors (for both browser and Murf AI)
    
    const [isFetching, setIsFetching] = useState(false); // For Gita data fetching
    const murfAudioRef = useRef(null); // Ref for Murf AI audio playback

    const [murfVoices, setMurfVoices] = useState([]); // Stores ALL available Murf AI voices fetched from API
    const [isMurfSpeaking, setIsMurfSpeaking] = useState(false); // State for Murf AI loading indicator

    // Dynamically determined effective voice configs
    const [effectiveHindiVoiceConfig, setEffectiveHindiVoiceConfig] = useState(null);
    const [effectiveEnglishVoiceConfig, setEffectiveEnglishVoiceConfig] = useState(null);

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
        // Stop any ongoing audio before fetching new slok
        if (murfAudioRef.current) murfAudioRef.current.src = ''; 
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
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
        // Stop any ongoing audio before fetching new slok
        if (murfAudioRef.current) murfAudioRef.current.src = '';
        if (window.speechSynthesis) window.speechSynthesis.cancel();

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

    // Function to fetch available Murf AI voices and set dynamic defaults
    const fetchMurfVoices = async () => {
        try {
            const response = await fetch('https://api.murf.ai/v1/speech/voices', {
                method: 'GET',
                headers: {
                    'api-key': murfApiKey 
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 403) {
                     throw new Error(`Authorization failed when fetching Murf AI voices. Please verify your API key and account permissions. Details: ${errorText}`);
                }
                throw new Error(`Failed to fetch Murf AI voices: ${response.status} ${response.statusText} - ${errorText}`);
            }
            const data = await response.json();
            console.log("Murf AI Available Voices:", data); 
            if (data && Array.isArray(data.voices)) {
                setMurfVoices(data.voices);

                // Try to find the user's preferred voices first
                const ishaniVoice = data.voices.find(voice => voice.id === 'bn-IN-ishani');
                const naomiVoice = data.voices.find(voice => voice.id === 'en-US-naomi');

                // Dynamic English Voice (for general English and Sivananda)
                if (ishaniVoice) {
                    setEffectiveEnglishVoiceConfig({ voiceId: ishaniVoice.id, style: 'Conversational', multi_native_locale: 'en_IN' });
                    console.log("Murf AI: Using preferred English voice: bn-IN-ishani");
                } else {
                    const firstEnglishVoice = data.voices.find(voice => voice.lang.startsWith('en-'));
                    if (firstEnglishVoice) {
                        setEffectiveEnglishVoiceConfig({ voiceId: firstEnglishVoice.id, style: 'Conversational', multi_native_locale: firstEnglishVoice.lang.replace('-', '_') });
                        console.warn(`Murf AI: bn-IN-ishani not available. Using first available English voice: ${firstEnglishVoice.id}`);
                    } else {
                        setEffectiveEnglishVoiceConfig(null);
                        console.error("Murf AI: No English voice available in your account. English TTS will be disabled.");
                    }
                }

                // Dynamic Hindi Voice
                if (naomiVoice) {
                    setEffectiveHindiVoiceConfig({ voiceId: naomiVoice.id, style: 'Conversational', multi_native_locale: 'hi_IN' });
                    console.log("Murf AI: Using preferred Hindi voice: en-US-naomi");
                } else {
                    const firstHindiVoice = data.voices.find(voice => voice.lang.startsWith('hi-'));
                    if (firstHindiVoice) {
                        setEffectiveHindiVoiceConfig({ voiceId: firstHindiVoice.id, style: 'Conversational', multi_native_locale: firstHindiVoice.lang.replace('-', '_') });
                        console.warn(`Murf AI: en-US-naomi not available for Hindi. Using first available Hindi voice: ${firstHindiVoice.id}`);
                    } else if (effectiveEnglishVoiceConfig) { // Fallback to English voice if no Hindi voice found
                        setEffectiveHindiVoiceConfig(effectiveEnglishVoiceConfig);
                        console.warn(`Murf AI: No Hindi voice available. Falling back to English voice: ${effectiveEnglishVoiceConfig.voiceId} for Hindi translations.`);
                    } else {
                        setEffectiveHindiVoiceConfig(null);
                        console.error("Murf AI: No Hindi or English fallback voice available. Hindi TTS will be disabled.");
                    }
                }

            } else {
                console.warn("Murf AI voices response format unexpected:", data);
            }
        } catch (err) {
            console.error("Error fetching Murf AI voices:", err);
            setTtsMessage(`Error loading Murf AI voices: ${err.message}. Audio generation buttons might be disabled.`); 
        }
    };

    // Function to handle Text-to-Speech using Murf AI (now using /stream endpoint)
    const handleMurfAiTextToSpeech = async (translationType) => {
        if (!selectedSlok) {
            setTtsMessage("No slok selected to speak.");
            return;
        }

        let textToSpeak = '';
        let voiceConfig = null;
        let languageLabel = '';

        // Stop any currently playing audio (browser TTS or previous Murf AI)
        if (murfAudioRef.current) {
            murfAudioRef.current.pause();
            murfAudioRef.current.src = '';
        }
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
        setTtsMessage(''); // Clear previous message
        setIsMurfSpeaking(true); // Start loading indicator

        switch (translationType) {
            case 'hindi':
                textToSpeak = selectedSlok.tej?.ht;
                voiceConfig = effectiveHindiVoiceConfig;
                languageLabel = 'Hindi';
                break;
            case 'english':
                textToSpeak = selectedSlok.gambir?.et;
                voiceConfig = effectiveEnglishVoiceConfig;
                languageLabel = 'English';
                break;
            case 'sivananda':
                textToSpeak = selectedSlok.siva?.et;
                voiceConfig = effectiveEnglishVoiceConfig;
                languageLabel = 'Sivananda English';
                break;
            default:
                setTtsMessage("Invalid translation type selected.");
                setIsMurfSpeaking(false);
                return;
        }

        if (!textToSpeak || !textToSpeak.trim()) {
            setTtsMessage(`No ${languageLabel} translation available for this slok.`);
            setIsMurfSpeaking(false);
            return;
        }

        // Check if the dynamically chosen voice config is available
        if (!voiceConfig || !voiceConfig.voiceId || !murfVoices.some(v => v.id === voiceConfig.voiceId)) {
            setTtsMessage(`Error: No suitable voice found or available for ${languageLabel} translation. Check console for available voices.`);
            setIsMurfSpeaking(false);
            return;
        }

        setTtsMessage(`Generating ${languageLabel} audio via Murf AI using voice ID: ${voiceConfig.voiceId}...`);
        try {
            const response = await fetch(murfApiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${murfApiKey}`, 
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: textToSpeak,
                    voice_id: voiceConfig.voiceId, 
                    format: 'MP3',
                    style: voiceConfig.style, 
                    multi_native_locale: voiceConfig.multi_native_locale 
                }),
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json(); 
                } catch (e) {
                    errorData = { errorMessage: await response.text() };
                }
                throw new Error(`Murf AI API error: ${response.status} - ${errorData.errorMessage || response.statusText}`);
            }

            const audioBlob = await response.blob(); 
            const audioUrl = URL.createObjectURL(audioBlob);

            console.log("Murf AI /stream API response data (blob received):", audioUrl); 
            
            if (murfAudioRef.current && audioUrl) {
                murfAudioRef.current.src = audioUrl;
                murfAudioRef.current.play().catch(err => {
                    console.error("Murf AI Audio playback failed:", err);
                    setTtsMessage(`Error playing ${languageLabel} audio (Murf AI): ${err.message}. Browser autoplay policy might be blocking it.`);
                    URL.revokeObjectURL(audioUrl); 
                });
                setTtsMessage(`Playing ${languageLabel} audio (Murf AI)...`);
                murfAudioRef.current.onended = () => {
                    setTtsMessage(`${languageLabel} playback finished (Murf AI).`);
                    URL.revokeObjectURL(audioUrl); 
                    console.log("Murf AI audio object URL revoked.");
                };
                murfAudioRef.current.onerror = () => {
                    setTtsMessage(`Error playing ${languageLabel} audio (Murf AI).`);
                    URL.revokeObjectURL(audioUrl); 
                    console.log("Murf AI audio object URL revoked on error.");
                };
            } else {
                throw new Error('Could not create audio URL from Murf AI response, or audio ref is missing.');
            }
        } catch (err) {
            console.error(`Error generating ${languageLabel} audio via Murf AI:`, err);
            setTtsMessage(`Failed to generate ${languageLabel} audio via Murf AI: ${err.message}`);
        } finally {
            setIsMurfSpeaking(false); // End loading indicator
        }
    };

    // Function to handle browser's native Text-to-Speech
    const handleBrowserTextToSpeech = () => {
        if (!selectedSlok) {
            setTtsMessage("No slok selected to speak.");
            return;
        }

        let textToSpeak = '';
        let langCode = 'en-US'; // Default language for English translation

        // Stop any ongoing Murf AI audio or previous browser TTS
        if (murfAudioRef.current) murfAudioRef.current.src = '';
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        
        if (selectedSlok.gambir?.et) {
            textToSpeak = selectedSlok.gambir.et;
            setTtsMessage("Speaking English translation (Browser TTS)...");
            langCode = 'en-US';
        } else if (selectedSlok.slok) {
            textToSpeak = selectedSlok.slok;
            setTtsMessage("Speaking Sanskrit verse (Browser TTS, pronunciation depends on browser voice)...");
            langCode = 'hi-IN'; // Attempt Hindi voice for Sanskrit, or use 'en-US' as fallback
        }
        
        if (!textToSpeak.trim()) {
            setTtsMessage("No valid text found to speak using Browser TTS.");
            return;
        }

        // Check if SpeechSynthesis is supported
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            
            const voices = window.speechSynthesis.getVoices();
            const preferredVoice = voices.find(voice => voice.lang === langCode && voice.name.includes('Google') || voice.lang.startsWith(langCode.substring(0,2)));
            if (preferredVoice) {
                utterance.voice = preferredVoice;
            } else {
                const fallbackVoice = voices.find(voice => voice.lang === 'en-US' || voice.lang === 'en-GB');
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                    console.warn(`Preferred voice for ${langCode} not found, using fallback English voice for Browser TTS.`);
                } else {
                    console.warn("No suitable voice found, using browser default for Browser TTS.");
                }
            }

            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            utterance.onstart = () => {
                setTtsMessage("Speaking (Browser TTS)...");
            };

            utterance.onend = () => {
                setTtsMessage("Playback finished (Browser TTS).");
            };

            utterance.onerror = (event) => {
                console.error('SpeechSynthesis Utterance Error (Browser TTS):', event.error);
                setTtsMessage(`Browser TTS error: ${event.error}.`);
            };
            
            window.speechSynthesis.speak(utterance);
        } else {
            setTtsMessage("Browser Text-to-Speech not supported in your browser.");
            console.warn("SpeechSynthesis API not supported.");
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
        fetchMurfVoices(); // Fetch available voices on component mount for validation
    }, []);

    // Determine if the *effective* voices are available for button enabling/disabling
    const isHindiVoiceAvailable = effectiveHindiVoiceConfig && murfVoices.some(voice => voice.id === effectiveHindiVoiceConfig.voiceId);
    const isEnglishIshaniVoiceAvailable = effectiveEnglishVoiceConfig && murfVoices.some(voice => voice.id === effectiveEnglishVoiceConfig.voiceId);

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
                            if (murfAudioRef.current) murfAudioRef.current.src = '';
                            if (window.speechSynthesis) window.speechSynthesis.cancel();
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
                        &times;
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
                                    <p className="text-gray-600 dark:text-gray-300 sm:mt-2">
                                        <strong className="text-800 dark:text-gray-200">Summary:</strong> {chapter.summary.en.substring(0, 150)}...
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
                                <h3 className="text-2xl font-semibold mb-4 text-indigo-700 dark:text-indigo-400">Listen to Translations</h3>

                                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                                    {selectedSlok.tej?.ht && (
                                        <button
                                            onClick={() => handleMurfAiTextToSpeech('hindi')}
                                            // Ensure voice config is available before enabling
                                            disabled={isFetching || isMurfSpeaking || !effectiveHindiVoiceConfig}
                                            className="flex items-center px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Listen to Hindi translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" />
                                            {isMurfSpeaking ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...
                                                </>
                                            ) : (
                                                `Listen (Hindi - Murf AI) ${effectiveHindiVoiceConfig ? `(${getVoiceName(effectiveHindiVoiceConfig.voiceId)})` : ''}`
                                            )}
                                        </button>
                                    )}
                                    {selectedSlok.gambir?.et && (
                                        <button
                                            onClick={() => handleMurfAiTextToSpeech('english')}
                                            // Ensure voice config is available before enabling
                                            disabled={isFetching || isMurfSpeaking || !effectiveEnglishVoiceConfig}
                                            className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Listen to audio for English translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" />
                                            {isMurfSpeaking ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...
                                                </>
                                            ) : (
                                                `Listen (English - Murf AI) ${effectiveEnglishVoiceConfig ? `(${getVoiceName(effectiveEnglishVoiceConfig.voiceId)})` : ''}`
                                            )}
                                        </button>
                                    )}
                                    {selectedSlok.siva?.et && (
                                        <button
                                            onClick={() => handleMurfAiTextToSpeech('sivananda')}
                                            // Ensure voice config is available before enabling
                                            disabled={isFetching || isMurfSpeaking || !effectiveEnglishVoiceConfig}
                                            className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                            aria-label="Listen to audio for Sivananda translation"
                                        >
                                            <Volume2 className="w-5 h-5 mr-2" />
                                            {isMurfSpeaking ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating...
                                                </>
                                            ) : (
                                                `Listen (Sivananda - Murf AI) ${effectiveEnglishVoiceConfig ? `(${getVoiceName(effectiveEnglishVoiceConfig.voiceId)})` : ''}`
                                            )}
                                        </button>
                                    )}

                                    {/* Browser TTS Button */}
                                    <button
                                        onClick={handleBrowserTextToSpeech}
                                        disabled={isFetching || isMurfSpeaking} // Disable if fetching data or Murf AI is speaking
                                        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                        aria-label="Listen using browser's built-in text-to-speech"
                                    >
                                        <Volume2 className="w-5 h-5 mr-2" /> Listen (Browser TTS)
                                    </button>

                                </div>
                                {ttsMessage && (
                                    <p className={`mt-2 text-sm ${ttsMessage.includes('Error') ? 'text-red-500' : 'text-gray-700 dark:text-gray-400'}`}>
                                        {ttsMessage}
                                    </p>
                                )}
                                <audio
                                    ref={murfAudioRef}
                                    controls
                                    className="w-full mt-4 rounded-lg bg-gray-200 dark:bg-gray-800"
                                    aria-label="Audio control for audio player for slok"
                                ></audio>
                            </div>
                        </div>
                    )}
                </main>
            )}

            <footer className="text-center text-gray-600 dark:text-gray-400 mt-12 text-sm">
                <p>Hare Krishna! 🙏</p>
                <p>&copy; {new Date().getFullYear()} Bhagavad Gita Wisdom App. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;
