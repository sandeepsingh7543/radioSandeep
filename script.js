// ===================================================================
// TIME RADIO — Vintage Indian Radio • YouTube IFrame API
// ===================================================================

// =================================================================
// CONFIGURATION
// =================================================================
const RADIO_CONFIG = {
  playlistUrl: "https://music.youtube.com/playlist?list=PLeatb7hupNV_AWUl_7ttbsKeCQh8tF5N4"
};

// =================================================================
// URL PARSER
// =================================================================
const URLParser = {
  parse(input) {
    if (!input || typeof input !== 'string') return null;
    input = input.trim();
    if (/^(PL|OL|RD|UU|LL|OLAK5uy)[a-zA-Z0-9_-]+$/.test(input)) return { type: 'playlist', id: input };
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return { type: 'video', id: input };
    try {
      const url = new URL(input);
      const host = url.hostname.replace(/^www\./, '');
      if (['music.youtube.com', 'youtube.com', 'm.youtube.com'].includes(host)) {
        const list = url.searchParams.get('list');
        const video = url.searchParams.get('v');
        if (list) return { type: 'playlist', id: list };
        if (video) return { type: 'video', id: video };
      }
      if (host === 'youtu.be') {
        const vid = url.pathname.slice(1).split('/')[0];
        if (vid && vid.length === 11) return { type: 'video', id: vid };
      }
    } catch (e) {}
    if (input.length > 5) return { type: 'playlist', id: input };
    return null;
  },
  getPlaylistId() { const r = this.parse(RADIO_CONFIG.playlistUrl); return r ? r.id : null; },
  getMediaType() { const r = this.parse(RADIO_CONFIG.playlistUrl); return r ? r.type : null; }
};

// =================================================================
// STATE
// =================================================================
const State = {
  isPlaying: false,
  isPowerOn: true,
  isShuffleOn: false,
  playerReady: false,
  playlistOpen: false,
  playlistLength: 0,
  currentIndex: 0,
  volume: 80,
  knobAngle: 230,
  progressTimer: null,
  player: null,
  domReady: false,
  apiReady: false
};

// Track title cache
const trackTitles = {};

// =================================================================
// YOUTUBE API READY (called by YouTube — must be global)
// =================================================================
function onYouTubeIframeAPIReady() {
  console.log('[TIME RADIO] YouTube API Ready');
  State.apiReady = true;
  if (State.domReady) {
    initPlayer();
  }
}

// =================================================================
// DOM READY
// =================================================================
document.addEventListener('DOMContentLoaded', function () {
  console.log('[TIME RADIO] DOM Ready');
  State.domReady = true;

  // --- DOM REFS ---
  const DOM = {
    radio: document.getElementById('radio'),
    btnPower: document.getElementById('btnPower'),
    btnShuffle: document.getElementById('btnShuffle'),
    btnPrev: document.getElementById('btnPrev'),
    btnPlay: document.getElementById('btnPlay'),
    btnNext: document.getElementById('btnNext'),
    btnPlaylist: document.getElementById('btnPlaylist'),
    btnPlaylistClose: document.getElementById('btnPlaylistClose'),
    iconPlay: document.querySelector('.icon-play'),
    iconPause: document.querySelector('.icon-pause'),
    ledGlow: document.getElementById('ledGlow'),
    crtGlow: document.getElementById('crtGlow'),
    displayStation: document.getElementById('displayStation'),
    displayStatus: document.getElementById('displayStatus'),
    songTitle: document.getElementById('songTitle'),
    songArtist: document.getElementById('songArtist'),
    songNumber: document.getElementById('songNumber'),
    displayLabel: document.getElementById('displayLabel'),
    currentTime: document.getElementById('currentTime'),
    totalTime: document.getElementById('totalTime'),
    speakerGrille: document.getElementById('speakerGrille'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeKnob: document.getElementById('volumeKnob'),
    progressBar: document.getElementById('progressBar'),
    progressTrack: document.getElementById('progressTrack'),
    tuningNeedle: document.getElementById('tuningNeedle'),
    playlistPanel: document.getElementById('playlistPanel'),
    playlistItems: document.getElementById('playlistItems')
  };

  // Store DOM globally for initPlayer access
  window._DOM = DOM;

  // --- UTILITIES ---
  function formatTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function progressChars(current, total) {
    if (!total || total <= 0) return '━━━━━━━━━━━━';
    const filled = Math.round((current / total) * 12);
    return '━'.repeat(filled) + '─'.repeat(12 - filled);
  }

  function volumeToAngle(vol) { return 30 + (vol / 100) * 300; }

  // --- UI UPDATES ---
  window._updatePlayIcon = function () {
    if (State.isPlaying) {
      DOM.iconPlay.style.display = 'none';
      DOM.iconPause.style.display = 'block';
      DOM.btnPlay.classList.add('is-playing');
      DOM.btnPlay.setAttribute('aria-label', 'Pause');
    } else {
      DOM.iconPlay.style.display = 'block';
      DOM.iconPause.style.display = 'none';
      DOM.btnPlay.classList.remove('is-playing');
      DOM.btnPlay.setAttribute('aria-label', 'Play');
    }
  };

  window._activateCRT = function () {
    DOM.crtGlow.classList.add('active');
    DOM.speakerGrille.classList.add('playing');
  };

  window._deactivateCRT = function () {
    DOM.crtGlow.classList.remove('active');
    DOM.speakerGrille.classList.remove('playing');
  };

  window._setKnobRotation = function (vol) {
    State.knobAngle = volumeToAngle(vol);
    const knobBody = DOM.volumeKnob.querySelector('.knob-body');
    if (knobBody) knobBody.style.transform = 'rotate(' + State.knobAngle + 'deg)';
    DOM.volumeKnob.setAttribute('aria-valuenow', vol);
  };

  window._moveNeedle = function () {
    if (!DOM.tuningNeedle) return;
    const pos = 15 + ((State.currentIndex * 37 + 13) % 70);
    DOM.tuningNeedle.style.left = pos + '%';
  };

  window._updateNowPlaying = function () {
    if (!State.player || !State.playerReady) return;
    try {
      const data = State.player.getVideoData();
      const title = data.title || 'Unknown';
      const author = data.author || '';
      State.currentIndex = State.player.getPlaylistIndex() || 0;
      const playlist = State.player.getPlaylist();
      State.playlistLength = playlist ? playlist.length : 1;

      DOM.displayStation.textContent = "90'S HITS";
      DOM.displayStatus.textContent = 'NOW PLAYING';
      DOM.songTitle.textContent = title;
      DOM.songArtist.textContent = author;
      const idx = String(State.currentIndex + 1).padStart(2, '0');
      const total = String(State.playlistLength).padStart(2, '0');
      DOM.songNumber.textContent = idx + ' / ' + total;

      // Cache title
      trackTitles[State.currentIndex] = title;

      window._moveNeedle();
      window._highlightPlaylistItem();
    } catch (e) {
      console.warn('[TIME RADIO] Display error:', e);
    }
  };

  window._updateProgress = function () {
    if (!State.player || !State.playerReady) return;
    try {
      const cur = State.player.getCurrentTime() || 0;
      const dur = State.player.getDuration() || 0;
      DOM.currentTime.textContent = formatTime(cur);
      DOM.totalTime.textContent = formatTime(dur);
      DOM.displayLabel.textContent = progressChars(cur, dur);
      if (dur > 0) {
        DOM.progressBar.style.width = (cur / dur) * 100 + '%';
      }
    } catch (e) {}
  };

  window._startProgress = function () {
    window._stopProgress();
    State.progressTimer = setInterval(window._updateProgress, 1000);
  };

  window._stopProgress = function () {
    if (State.progressTimer) { clearInterval(State.progressTimer); State.progressTimer = null; }
  };

  window._resetProgress = function () {
    DOM.progressBar.style.width = '0%';
    DOM.currentTime.textContent = '0:00';
    DOM.totalTime.textContent = '0:00';
    DOM.displayLabel.textContent = '━━━━━━━━━━━━';
  };

  // --- PLAYLIST ---
  window._buildPlaylist = function () {
    if (!State.player || !State.playerReady) return;
    const playlist = State.player.getPlaylist();
    if (!playlist || playlist.length === 0) {
      DOM.playlistItems.innerHTML = '<div class="playlist-empty">Press Play first</div>';
      return;
    }
    let html = '';
    for (let i = 0; i < playlist.length; i++) {
      const num = String(i + 1).padStart(2, '0');
      const activeClass = i === State.currentIndex ? ' active' : '';
      const title = trackTitles[i] || 'Loading...';
      const videoId = playlist[i];
      // YouTube thumbnail URL (no API key needed)
      const thumb = 'https://img.youtube.com/vi/' + videoId + '/default.jpg';
      html += '<div class="playlist-item' + activeClass + '" data-index="' + i + '" role="listitem">';
      html += '<img class="playlist-item-thumb" src="' + thumb + '" alt="" loading="lazy" />';
      html += '<div class="playlist-item-info">';
      html += '<span class="playlist-item-num">' + num + '</span>';
      html += '<span class="playlist-item-title">' + title + '</span>';
      html += '</div>';
      html += '</div>';
    }
    DOM.playlistItems.innerHTML = html;
    DOM.playlistItems.querySelectorAll('.playlist-item').forEach(function (item) {
      item.addEventListener('click', function () {
        const idx = parseInt(this.dataset.index, 10);
        if (State.player && State.playerReady) State.player.playVideoAt(idx);
      });
    });

    // Fetch all track titles using noembed (free, no API key)
    playlist.forEach(function (videoId, i) {
      if (trackTitles[i]) return; // already cached
      fetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + videoId)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.title) {
            trackTitles[i] = data.title;
            // Update the DOM element
            const items = DOM.playlistItems.querySelectorAll('.playlist-item');
            if (items[i]) {
              const titleEl = items[i].querySelector('.playlist-item-title');
              if (titleEl) titleEl.textContent = data.title;
            }
          }
        })
        .catch(function () { /* silent */ });
    });
  };

  window._highlightPlaylistItem = function () {
    const items = DOM.playlistItems.querySelectorAll('.playlist-item');
    items.forEach(function (item, i) {
      item.classList.toggle('active', i === State.currentIndex);
      if (trackTitles[i]) {
        const el = item.querySelector('.playlist-item-title');
        if (el) el.textContent = trackTitles[i];
      }
    });
    // Scroll active into view
    const active = DOM.playlistItems.querySelector('.playlist-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  // --- PLAYBACK ---
  window._togglePlay = function () {
    if (!State.playerReady || !State.player) {
      DOM.songTitle.textContent = 'Loading... Please wait';
      DOM.displayStatus.textContent = 'LOADING';
      return;
    }
    const st = State.player.getPlayerState();
    if (st === YT.PlayerState.PLAYING) {
      State.player.pauseVideo();
    } else {
      State.player.unMute();
      State.player.setVolume(State.volume);
      State.player.playVideo();
      DOM.songTitle.textContent = 'Starting...';
      DOM.displayStatus.textContent = 'BUFFERING';
    }
  };

  window._playNext = function () {
    if (!State.playerReady || !State.player) return;
    window._resetProgress();
    if (State.isShuffleOn) {
      const pl = State.player.getPlaylist();
      if (pl && pl.length > 1) {
        let idx;
        do { idx = Math.floor(Math.random() * pl.length); }
        while (idx === State.currentIndex && pl.length > 1);
        State.player.playVideoAt(idx);
      }
    } else {
      State.player.nextVideo();
    }
  };

  window._playPrev = function () {
    if (!State.playerReady || !State.player) return;
    window._resetProgress();
    State.player.previousVideo();
  };

  window._setVolume = function (vol) {
    vol = Math.max(0, Math.min(100, vol));
    State.volume = vol;
    window._setKnobRotation(vol);
    DOM.volumeSlider.value = vol;
    if (State.player && State.playerReady) {
      State.player.setVolume(vol);
      State.player.unMute();
    }
  };

  function powerOn() {
    State.isPowerOn = true;
    DOM.radio.classList.remove('off');
    DOM.btnPower.classList.add('on');
    DOM.btnPower.setAttribute('aria-pressed', 'true');
    DOM.ledGlow.classList.add('on');
    if (State.isPlaying) { window._updateNowPlaying(); window._activateCRT(); }
    else { DOM.songTitle.textContent = 'Press Play to Begin'; DOM.displayStatus.textContent = 'READY'; }
  }

  function powerOff() {
    State.isPowerOn = false;
    DOM.radio.classList.add('off');
    DOM.btnPower.classList.remove('on');
    DOM.btnPower.setAttribute('aria-pressed', 'false');
    DOM.ledGlow.classList.remove('on');
    window._deactivateCRT();
    window._stopProgress();
    if (State.isPlaying && State.player) State.player.pauseVideo();
    DOM.songTitle.textContent = '— OFF —';
    DOM.songArtist.textContent = '';
    DOM.displayStation.textContent = '';
    DOM.displayStatus.textContent = '';
    DOM.songNumber.textContent = '--/--';
    window._resetProgress();
  }

  // --- EVENTS ---
  DOM.btnPlay.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!State.isPowerOn) powerOn();
    window._togglePlay();
  });

  DOM.btnNext.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (State.isPowerOn) window._playNext();
  });

  DOM.btnPrev.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (State.isPowerOn) window._playPrev();
  });

  DOM.btnShuffle.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!State.isPowerOn) return;
    State.isShuffleOn = !State.isShuffleOn;
    DOM.btnShuffle.classList.toggle('active', State.isShuffleOn);
    DOM.btnShuffle.setAttribute('aria-pressed', String(State.isShuffleOn));
    if (State.player && State.playerReady) State.player.setShuffle(State.isShuffleOn);
    DOM.displayStatus.textContent = State.isShuffleOn ? 'SHUFFLE ON' : 'SHUFFLE OFF';
    setTimeout(function () {
      if (State.isPlaying) window._updateNowPlaying();
      else DOM.displayStatus.textContent = 'READY';
    }, 2000);
  });

  DOM.btnPlaylist.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!State.isPowerOn) return;
    State.playlistOpen = !State.playlistOpen;
    DOM.playlistPanel.classList.toggle('open', State.playlistOpen);
    DOM.btnPlaylist.classList.toggle('active', State.playlistOpen);
    if (State.playlistOpen) window._buildPlaylist();
  });

  DOM.btnPlaylistClose.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    State.playlistOpen = false;
    DOM.playlistPanel.classList.remove('open');
    DOM.btnPlaylist.classList.remove('active');
  });

  DOM.btnPower.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (State.isPowerOn) powerOff(); else powerOn();
  });

  DOM.volumeSlider.addEventListener('input', function () {
    window._setVolume(parseInt(this.value, 10));
  });

  DOM.progressTrack.addEventListener('click', function (e) {
    if (!State.player || !State.playerReady) return;
    const rect = this.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = State.player.getDuration();
    if (dur > 0) State.player.seekTo(pct * dur, true);
  });

  // Volume knob drag
  (function () {
    let startY = 0, startVol = 0, dragging = false;
    DOM.volumeKnob.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startVol = State.volume;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
    function onMove(e) {
      if (!dragging) return;
      const delta = (startY - e.clientY) * 0.5;
      window._setVolume(Math.round(startVol + delta));
    }
    function onUp() {
      dragging = false;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    }
    DOM.volumeKnob.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); window._setVolume(State.volume + 5); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); window._setVolume(State.volume - 5); }
    });
  })();

  // Keyboard
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (!State.isPowerOn && e.code !== 'Space') return;
    switch (e.code) {
      case 'Space': e.preventDefault(); if (!State.isPowerOn) powerOn(); window._togglePlay(); break;
      case 'ArrowRight': e.preventDefault(); window._playNext(); break;
      case 'ArrowLeft': e.preventDefault(); window._playPrev(); break;
      case 'ArrowUp': e.preventDefault(); window._setVolume(State.volume + 10); break;
      case 'ArrowDown': e.preventDefault(); window._setVolume(State.volume - 10); break;
      case 'KeyS': e.preventDefault(); DOM.btnShuffle.click(); break;
      case 'KeyP': e.preventDefault(); DOM.btnPlaylist.click(); break;
    }
  });

  // --- INIT UI ---
  DOM.ledGlow.classList.add('on');
  DOM.btnPower.classList.add('on');
  window._updatePlayIcon();
  window._setKnobRotation(State.volume);
  DOM.songTitle.textContent = 'Initializing...';
  DOM.displayStation.textContent = "90'S HITS";
  DOM.displayStatus.textContent = 'LOADING';

  console.log('[TIME RADIO] ♫ Vintage Indian Radio');
  console.log('[TIME RADIO] Keys: Space=Play ←→=Track ↑↓=Vol S=Shuffle P=Playlist');

  // If YouTube API already loaded before DOM was ready
  if (State.apiReady) {
    initPlayer();
  }

  // Cleanup
  window.addEventListener('beforeunload', function () {
    window._stopProgress();
    if (State.player && typeof State.player.destroy === 'function') {
      State.player.destroy();
      State.player = null;
    }
  });
});

// =================================================================
// INIT PLAYER (called when both DOM + API are ready)
// =================================================================
function initPlayer() {
  const mediaType = URLParser.getMediaType();
  const mediaId = URLParser.getPlaylistId();

  if (!mediaId) {
    console.error('[TIME RADIO] Invalid playlist URL');
    if (window._DOM) window._DOM.songTitle.textContent = 'Config Error';
    return;
  }

  console.log('[TIME RADIO] Creating player | Type:', mediaType, '| ID:', mediaId);

  const playerVars = {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    modestbranding: 1,
    rel: 0,
    playsinline: 1,
    origin: window.location.origin
  };

  if (mediaType === 'playlist') {
    playerVars.listType = 'playlist';
    playerVars.list = mediaId;
  }

  const config = {
    width: 300,
    height: 200,
    playerVars: playerVars,
    events: {
      onReady: function (event) {
        State.playerReady = true;
        event.target.setVolume(State.volume);
        event.target.unMute();

        if (window._DOM) {
          window._DOM.displayStatus.textContent = 'READY';
          window._DOM.songTitle.textContent = 'Press Play to Begin';
        }
        window._setKnobRotation(State.volume);

        // Wait for playlist to populate
        let tries = 0;
        const waitPl = setInterval(function () {
          tries++;
          const pl = State.player.getPlaylist();
          if (pl && pl.length > 0) {
            clearInterval(waitPl);
            State.playlistLength = pl.length;
            if (window._DOM) {
              window._DOM.songNumber.textContent = '01 / ' + String(pl.length).padStart(2, '0');
            }
            window._buildPlaylist();
            console.log('[TIME RADIO] ✓ Playlist ready:', pl.length, 'tracks');
          } else if (tries > 30) {
            clearInterval(waitPl);
            console.warn('[TIME RADIO] Playlist timeout — will load on play');
          }
        }, 500);

        console.log('[TIME RADIO] ✓ Player ready');
      },

      onStateChange: function (event) {
        switch (event.data) {
          case YT.PlayerState.PLAYING:
            State.isPlaying = true;
            window._updatePlayIcon();
            window._activateCRT();
            window._startProgress();
            State.player.unMute();
            State.player.setVolume(State.volume);
            setTimeout(function () {
              window._updateNowPlaying();
              // Rebuild playlist with actual data
              const pl = State.player.getPlaylist();
              if (pl && pl.length > 0) {
                State.playlistLength = pl.length;
                window._buildPlaylist();
              }
            }, 800);
            break;

          case YT.PlayerState.PAUSED:
            State.isPlaying = false;
            window._updatePlayIcon();
            window._deactivateCRT();
            window._stopProgress();
            break;

          case YT.PlayerState.ENDED:
            State.isPlaying = false;
            window._updatePlayIcon();
            window._deactivateCRT();
            window._stopProgress();
            window._resetProgress();
            break;

          case YT.PlayerState.BUFFERING:
            if (window._DOM) window._DOM.displayStatus.textContent = 'BUFFERING';
            break;

          case YT.PlayerState.CUED:
            window._updateNowPlaying();
            window._resetProgress();
            break;

          case -1: // UNSTARTED / autoplay blocked
            if (State.isPlaying) {
              State.isPlaying = false;
              window._updatePlayIcon();
              window._deactivateCRT();
              if (window._DOM) {
                window._DOM.songTitle.textContent = 'Tap Play to start';
                window._DOM.displayStatus.textContent = 'READY';
              }
            }
            break;
        }
      },

      onError: function (event) {
        const codes = { 2: 'Invalid ID', 5: 'Player error', 100: 'Not found', 101: 'Embed blocked', 150: 'Embed blocked' };
        console.warn('[TIME RADIO] ⚠', codes[event.data] || 'Error ' + event.data);
        if (window._DOM) {
          window._DOM.songTitle.textContent = 'Unavailable — Skipping...';
          window._DOM.displayStatus.textContent = 'ERROR';
        }
        setTimeout(function () {
          if (State.player && State.playerReady) {
            const pl = State.player.getPlaylist();
            if (pl && pl.length > 1) State.player.nextVideo();
          }
        }, 2000);
      }
    }
  };

  if (mediaType === 'video') {
    config.videoId = mediaId;
  }

  State.player = new YT.Player('ytPlayer', config);
}
