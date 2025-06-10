import React, { useState, useEffect } from 'react';
import { ChevronLeft, BookOpen, Search, Shuffle, ChevronRight } from 'lucide-react'; // Importing icons

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

    // Base URL for the Bhagavad Gita API
    const bgBaseUrl = "https://vedicscriptures.github.io";

    // Array containing the number of sloks in each chapter (0-indexed for convenience)
    // Chapter 1 has 47 sloks, Chapter 2 has 72, etc.
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
            setChapters(data);
        } catch (err) {
            console.error("Error fetching chapters:", err);
            setError("Failed to load chapters. Please try again later.");
        } finally {
            setLoading(false);
        }
    };

    // Function to fetch a specific slok by chapter and verse
    const fetchSpecificSlok = async (chapter, verse) => {
        setLoading(true);
        setError(null);
        setSelectedSlok(null); // Clear previous slok
        try {
            const response = await fetch(`${bgBaseUrl}/slok/${chapter}/${verse}`, { redirect: 'follow' });
            if (!response.ok) {
                // If the response is not OK, it means the slok doesn't exist or there's an API issue.
                throw new Error(`Could not fetch the requested Slok. Please check the chapter and verse numbers. (Chapter: ${chapter}, Verse: ${verse})`);
            }
            const slok = await response.json();
            setSelectedSlok(slok);
            setViewMode('slokDetail'); // Switch to slok detail view
        } catch (err) {
            console.error("Error fetching specific slok:", err);
            setError(err.message || "Failed to fetch specific slok. Please check the chapter and verse.");
        } finally {
            setLoading(false);
        }
    };

    // Function to fetch a random slok
    const fetchRandomSlok = async () => {
        setLoading(true);
        setError(null);
        setSelectedSlok(null); // Clear previous slok
        try {
            // Randomly select a chapter (1 to 18)
            const chapter = Math.floor(Math.random() * slokCounts.length) + 1;
            // Randomly select a verse within the chosen chapter's limits
            const verse = Math.floor(Math.random() * slokCounts[chapter - 1]) + 1;
            const slokId = `${chapter}/${verse}`;

            const response = await fetch(`${bgBaseUrl}/slok/${slokId}`, { redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`Failed to fetch random slok. HTTP error! status: ${response.status}`);
            }
            const slok = await response.json();
            setSelectedSlok(slok);
            setViewMode('slokDetail'); // Switch to slok detail view
        } catch (err) {
            console.error("Error fetching random slok:", err);
            setError("Failed to fetch a random slok. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Function to handle fetching the next slok
    const handleNextSlok = () => {
        if (!selectedSlok) {
            // If no slok is currently selected, do nothing or fetch a default/random one.
            setError("No current slok to find the next one. Try fetching a slok first.");
            return;
        }

        let nextChapter = selectedSlok.chapter;
        let nextVerse = selectedSlok.verse + 1;

        // Check if the current verse is the last in its chapter
        if (nextVerse > slokCounts[selectedSlok.chapter - 1]) {
            nextChapter += 1; // Move to the next chapter
            nextVerse = 1; // Start from the first verse of the new chapter

            // Check if the next chapter exceeds the total number of chapters
            if (nextChapter > slokCounts.length) {
                nextChapter = 1; // Loop back to the first chapter
                nextVerse = 1; // First verse of the first chapter
            }
        }
        // Fetch the calculated next slok
        fetchSpecificSlok(nextChapter, nextVerse);
    };

    // Prepares the slok data for display in a structured format
    const prepareSlokForDisplay = (slok) => {
        if (!slok) return '';
        return (
            <div>
                <p className="font-semibold text-lg mb-2">Chapter {slok.chapter}, Verse {slok.verse}</p>
                <p className="text-gray-700 dark:text-gray-300 font-sans text-xl my-4 italic">"{slok.slok}"</p>
                {slok.tej && slok.tej.ht && (
                    <p className="mb-2"><strong className="text-gray-800 dark:text-gray-200">Hindi Translation:</strong> {slok.tej.ht}</p>
                )}
                {slok.gambir && slok.gambir.et && (
                    <p className="mb-2"><strong className="text-gray-800 dark:text-gray-200">English Translation:</strong> {slok.gambir.et}</p>
                )}
                {slok.siva && slok.siva.et && (
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

    // Handle form submission for specific slok
    const handleGetSlokSubmit = (e) => {
        e.preventDefault(); // Prevent default form submission behavior
        const chapter = parseInt(slokChapterInput, 10);
        const verse = parseInt(slokVerseInput, 10);

        // Input validation
        if (isNaN(chapter) || isNaN(verse) || chapter <= 0 || verse <= 0 || chapter > slokCounts.length || verse > (slokCounts[chapter - 1] || 0)) {
            setError("Please enter valid positive numbers for chapter (1-18) and verse within its range.");
            return;
        }
        fetchSpecificSlok(chapter, verse);
    };

    // Handle chapter card click to show chapter details
    const handleChapterClick = (chapterNumber) => {
        const chapter = chapters.find(c => c.chapter_number === chapterNumber);
        setSelectedChapter(chapter);
        setViewMode('chapterDetail'); // A new view mode to show chapter summary before verses
    };

    // Handle verse button click from chapter detail view to fetch specific slok
    const handleVerseClick = (chapterNumber, verseNumber) => {
        fetchSpecificSlok(chapterNumber, verseNumber);
    };

    // Initial fetch of chapters when the component mounts
    useEffect(() => {
        fetchChapters();
    }, []); // Empty dependency array ensures this runs only once on mount

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

            {/* Navigation and global actions */}
            <nav className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
                {/* 'Back to Chapters' button, shown when not in the main chapters view */}
                {viewMode !== 'chapters' && (
                    <button
                        onClick={() => {
                            setViewMode('chapters');
                            setSelectedChapter(null);
                            setSelectedSlok(null);
                            setError(null); // Clear any errors
                        }}
                        className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        <ChevronLeft className="w-5 h-5 mr-2" /> Back to Chapters
                    </button>
                )}
                {/* 'Random Slok' button, always available */}
                <button
                    onClick={fetchRandomSlok}
                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                >
                    <Shuffle className="w-5 h-5 mr-2" /> Random Slok
                </button>

                {/* 'Next Slok' button, only shown when a slok is being displayed */}
                {viewMode === 'slokDetail' && (
                    <button
                        onClick={handleNextSlok}
                        className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Next Slok <ChevronRight className="w-5 h-5 ml-2" />
                    </button>
                )}
            </nav>

            {/* Search/Get Specific Slok Form */}
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
                        min="1" // Minimum value for chapter
                        max="18" // Maximum value for chapter
                    />
                    <input
                        type="number"
                        placeholder="Verse"
                        value={slokVerseInput}
                        onChange={(e) => setSlokVerseInput(e.target.value)}
                        className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        min="1" // Minimum value for verse
                        // Max value for verse will depend on the chapter, but generally it's handled by validation
                    />
                    <button
                        type="submit"
                        className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    >
                        Get Slok
                    </button>
                </form>
            </div>

            {/* Loading and Error Indicators */}
            {loading && (
                <div className="text-center text-indigo-700 dark:text-indigo-300 text-xl font-medium my-8">
                    Loading... Please wait for a few seconds.
                </div>
            )}
            {error && (
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl relative max-w-2xl mx-auto my-8 shadow-md" role="alert">
                    <strong className="font-bold">Error!</strong>
                    <span className="block sm:inline ml-2">{error}</span>
                </div>
            )}

            {/* Main content area based on viewMode */}
            {!loading && !error && (
                <main>
                    {viewMode === 'chapters' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                            {chapters.map((chapter) => (
                                <div
                                    key={chapter.chapter_number}
                                    onClick={() => handleChapterClick(chapter.chapter_number)}
                                    className="bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-xl transition duration-300 ease-in-out transform hover:-translate-y-1 border border-gray-200 dark:border-gray-600"
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
                                    <button className="mt-4 text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-500 font-semibold text-sm flex items-center">
                                        Read More <BookOpen className="w-4 h-4 ml-1" />
                                    </button>
                                </div>
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
                            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
                                {/* Generate verse buttons based on slokCounts for the selected chapter */}
                                {Array.from({ length: selectedChapter.verses_count }, (_, i) => i + 1).map((verseNum) => (
                                    <button
                                        key={verseNum}
                                        onClick={() => handleVerseClick(selectedChapter.chapter_number, verseNum)}
                                        className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-800 dark:text-gray-200 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900 transition duration-200 ease-in-out transform hover:scale-105 shadow-sm"
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
