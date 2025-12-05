// Elements
const body = document.body;
const audio = document.getElementById('audio-player');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const currTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume-slider');
const uploadInput = document.getElementById('music-upload');
const orbitsContainer = document.getElementById('orbits'); // Replaces playlistList
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const albumArt = document.getElementById('album-art');
const ytInput = document.getElementById('yt-url-input');
const loadYtBtn = document.getElementById('load-yt-btn');
const youtubePlayerEl = document.getElementById('youtube-player');
const sun = document.getElementById('sun');

// Theme Elements
const themeBtns = document.querySelectorAll('.theme-btn');

// State
let playlist = [];
let currentIndex = 0;
let isPlaying = false;
let currentMode = 'local'; // 'local' or 'youtube'
let ytPlayer = null;
let ytPollingInterval = null;

// Helpers
const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Theme Switching
themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const theme = btn.getAttribute('data-theme');
        body.setAttribute('data-theme', theme);
    });
});
// Set default theme
if (!body.hasAttribute('data-theme')) body.setAttribute('data-theme', 'dark');


// YouTube API initialization
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('youtube-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'playsinline': 1,
            'controls': 0, // Hide YT controls to use ours
            'disablekb': 1,
            'iv_load_policy': 3
        },
        events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
};

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        setIsPlaying(true);
        startYtPolling();
    } else if (event.data == YT.PlayerState.PAUSED) {
        setIsPlaying(false);
        stopYtPolling();
    } else if (event.data == YT.PlayerState.ENDED) {
        nextTrack();
    }
}

function onPlayerError(event) {
    console.error("YT Error:", event.data);
}

function startYtPolling() {
    if (ytPollingInterval) clearInterval(ytPollingInterval);
    ytPollingInterval = setInterval(() => {
        if (ytPlayer && ytPlayer.getCurrentTime) {
            const currentTime = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            updateProgressUI(currentTime, duration);
        }
    }, 500);
}

function stopYtPolling() {
    if (ytPollingInterval) clearInterval(ytPollingInterval);
}

function updateProgressUI(currentTime, duration) {
    if (isNaN(duration) || duration === 0) return;
    const progressPercent = (currentTime / duration) * 100;
    progressFill.style.width = `${progressPercent}%`;
    currTimeEl.textContent = formatTime(currentTime);
    durationEl.textContent = formatTime(duration);
}

function setIsPlaying(state) {
    isPlaying = state;
    if (isPlaying) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        sun.classList.add('playing');
    } else {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        sun.classList.remove('playing');
    }
}

// Core Functions
function loadTrack(index) {
    if (playlist.length === 0) return;

    if (index < 0) index = playlist.length - 1;
    if (index >= playlist.length) index = 0;

    currentIndex = index;
    const track = playlist[currentIndex];

    // Switch Mode Logic
    if (track.source === 'youtube') {
        currentMode = 'youtube';
        audio.pause(); // Stop local
        youtubePlayerEl.classList.remove('hidden');
        youtubePlayerEl.classList.add('active');
        // Hide standard art when YT is active? Or overlay it?
        // Let's hide the album art icon but keep the circle shape
        albumArt.innerHTML = '';

        if (ytPlayer && ytPlayer.loadVideoById) {
            ytPlayer.loadVideoById(track.id);
        }
    } else {
        currentMode = 'local';
        if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
        youtubePlayerEl.classList.add('hidden');
        youtubePlayerEl.classList.remove('active');

        albumArt.innerHTML = '<i class="fa-solid fa-music"></i>';

        if (track.file) {
            audio.src = URL.createObjectURL(track.file);
        }
    }

    trackTitle.textContent = track.title;
    trackArtist.textContent = track.artist;

    // Refresh UI to highlight active planet (if we want visual feedback there)
    renderSolarSystem();

    if (currentMode === 'local' && isPlaying) {
        playTrack();
    }
}

function playTrack() {
    if (currentMode === 'local') {
        audio.play()
            .then(() => setIsPlaying(true))
            .catch(err => console.error(err));
    } else {
        if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
    }
}

function pauseTrack() {
    if (currentMode === 'local') {
        audio.pause();
        setIsPlaying(false);
    } else {
        if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    }
}

function togglePlay() {
    if (isPlaying) {
        pauseTrack();
    } else {
        playTrack();
    }
}

function prevTrack() {
    loadTrack(currentIndex - 1);
}

function nextTrack() {
    loadTrack(currentIndex + 1);
}

function setProgress(e) {
    const width = this.clientWidth;
    const clickX = e.offsetX;

    if (currentMode === 'local') {
        const duration = audio.duration;
        if (isNaN(duration)) return;
        audio.currentTime = (clickX / width) * duration;
    } else {
        const duration = ytPlayer.getDuration();
        if (isNaN(duration)) return;
        const seekTime = (clickX / width) * duration;
        ytPlayer.seekTo(seekTime, true);
    }
}

function handleFiles(e) {
    const files = Array.from(e.target.files);

    const newTracks = files.map(file => ({
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: 'Local File',
        file: file,
        source: 'local'
    }));

    const wasEmpty = playlist.length === 0;
    playlist = [...playlist, ...newTracks];
    renderSolarSystem();

    if (wasEmpty) loadTrack(0);
}

function handleYouTubeLoad() {
    const url = ytInput.value.trim();
    if (!url) return;

    // Support Video ID only for simplicity in this queue visualizer
    // Playlist logic is complex for solar system (too many planets?)
    const vMatch = url.match(/[?&]v=([^&]+)/);
    const id = vMatch ? vMatch[1] : (url.includes('youtu.be/') ? url.split('youtu.be/')[1] : null);

    if (id) {
        const newTrack = {
            title: `YouTube Video ${id}`,
            artist: 'YouTube',
            source: 'youtube',
            id: id
        };
        const wasEmpty = playlist.length === 0;
        playlist.push(newTrack);
        renderSolarSystem();

        if (wasEmpty) loadTrack(0);
        ytInput.value = '';
    } else {
        alert("Please use a valid YouTube Video URL");
    }
}

// Render Planets
function renderSolarSystem() {
    orbitsContainer.innerHTML = '';

    // Config
    const baseRadius = 130;
    const radiusStep = 40;

    // We only render playing - 1 ... playing + X? 
    // Or render ALL. Let's render ALL.

    playlist.forEach((track, index) => {
        if (index === currentIndex) return; // The Sun is the current index!

        const orbitRing = document.createElement('div');
        orbitRing.classList.add('orbit-ring');

        // Randomize or sequential radius
        // To make it look distributed, let's use sequential radius but randomized angles
        // Radius depends on index distance from current?
        // Let's just stack them outwards.
        // If index > current, it's outer. If index < current, it's inner?
        // Simpler: Just assign a random radius bin.

        // Let's try to fit them all. 
        // We'll use (index + 1) * step if we want specific rings.
        // Or:
        const randomRadius = baseRadius + (Math.floor(Math.random() * 5) * radiusStep) + (index * 10);
        const duration = 10 + Math.random() * 30; // 10-40s orbit
        const direction = Math.random() > 0.5 ? 'normal' : 'reverse';
        const startAngle = Math.random() * 360;

        orbitRing.style.width = `${randomRadius * 2}px`;
        orbitRing.style.height = `${randomRadius * 2}px`;
        orbitRing.style.animation = `spin ${duration}s linear infinite ${direction}`;
        // Set initial rotation so they aren't all lined up
        // We can't easily set start angle in pure CSS keyframe without modifying the keyframe or using a wrapper with transform.
        // Easy hack: Wrapper div rotated to startAngle.

        // Create a wrapper for initial position
        const ringWrapper = document.createElement('div');
        ringWrapper.style.position = 'absolute';
        ringWrapper.style.top = '50%';
        ringWrapper.style.left = '50%';
        ringWrapper.style.width = '0';
        ringWrapper.style.height = '0';
        ringWrapper.style.transform = `rotate(${startAngle}deg)`;

        // Planet
        const planet = document.createElement('div');
        planet.classList.add('planet');
        planet.title = track.title;
        // Planet sits on the ring perimeter. 
        // top: 50%, left: 100% (minus half width) relative to ring?
        // Actually since we rotate the ring, just putting it at top: 0, left: 50% works if transform-origin is center.

        // Wait, best way:
        // Orbit Ring is centered. Planet is absolute at left: 50%, top: -20px (half size).
        // Then rotate ring.

        planet.style.top = `-20px`;
        planet.style.left = `calc(50% - 20px)`;

        // Visuals
        planet.innerHTML = `<i class="fa-solid ${track.source === 'youtube' ? 'fa-youtube' : 'fa-music'}"></i>`;

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.classList.add('tooltip');
        tooltip.textContent = track.title;
        planet.appendChild(tooltip);

        planet.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't click orbit
            loadTrack(index); // This becomes the sun
        });

        orbitRing.appendChild(planet);
        ringWrapper.appendChild(orbitRing);
        orbitsContainer.appendChild(ringWrapper);
    });
}


// Event Listeners
playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);

audio.addEventListener('timeupdate', (e) => {
    if (currentMode === 'local') updateProgressUI(e.srcElement.currentTime, e.srcElement.duration);
});
audio.addEventListener('ended', nextTrack);
audio.addEventListener('loadedmetadata', () => {
    if (currentMode === 'local') durationEl.textContent = formatTime(audio.duration);
});

progressContainer.addEventListener('click', setProgress);

volumeSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    audio.volume = val;
    if (ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(val * 100);

    // Visual icon update
    const icon = document.querySelector('.volume-container i');
    if (val == 0) icon.className = 'fa-solid fa-volume-xmark';
    else if (val < 0.5) icon.className = 'fa-solid fa-volume-low';
    else icon.className = 'fa-solid fa-volume-high';
});

uploadInput.addEventListener('change', handleFiles);
loadYtBtn.addEventListener('click', handleYouTubeLoad);

// Init
trackTitle.textContent = "Drop music or paste URL";
trackArtist.textContent = "Start your journey";

