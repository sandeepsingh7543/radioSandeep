// ===================================================================
// TIME RADIO — YouTube IFrame API Player
// ===================================================================

// === CONFIG — Multiple Playlists (random on each refresh) ===
const RADIO_CONFIG = {
  playlists: [
    { name: "90's Bollywood Hits", url: "https://music.youtube.com/playlist?list=PLeatb7hupNV_AWUl_7ttbsKeCQh8tF5N4" },
    { name: "Old Hindi Romantic Songs", url: "https://music.youtube.com/playlist?list=RDCLAK5uy_nLOvZAnN86K4f-fJ6tUi0xHUPBHLBBkVE" },
    { name: "Bollywood Retro", url: "https://music.youtube.com/playlist?list=RDCLAK5uy_l6TnLH20Ir4P2cfx1DNSxaZiea49NmIKY" },
    { name: "Seema", url: "https://music.youtube.com/playlist?list=PLgq4_mvJJU4B6RvGtnJ2jASXcuHykH6qr" },
    { name: "Bus Driver Playlist", url: "https://music.youtube.com/playlist?list=PLrc1-2uc6G7j--pBF0vbBxHvfI0gJhzdQ" },
    { name: "90s Bollywood", url: "https://music.youtube.com/playlist?list=RDCLAK5uy_kNNx8o3LyD3XF_wKmbZZRMsdiYpo5GjrM" }
  ]
};

// Pick random playlist on each load
var currentPlaylistIndex = Math.floor(Math.random() * RADIO_CONFIG.playlists.length);
var currentPlaylist = RADIO_CONFIG.playlists[currentPlaylistIndex];

// === PARSE PLAYLIST ID FROM URL ===
function getPlaylistId(url) {
  try {
    const u = new URL(url);
    return u.searchParams.get('list');
  } catch (e) {
    return url;
  }
}

// === GLOBALS ===
var player = null;
var isPlaying = false;
var isPowerOn = true;
var isShuffleOn = false;
var playerReady = false;
var progressTimer = null;
var volume = 80;
var trackTitles = {};
var playlistOpen = false;

// === SWITCH PLAYLIST ===
function switchPlaylist() {
  currentPlaylistIndex = (currentPlaylistIndex + 1) % RADIO_CONFIG.playlists.length;
  currentPlaylist = RADIO_CONFIG.playlists[currentPlaylistIndex];
  var playlistId = getPlaylistId(currentPlaylist.url);

  if (player && playerReady) {
    trackTitles = {};
    player.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0 });
    var stationEl = document.getElementById('displayStation');
    if (stationEl) stationEl.textContent = currentPlaylist.name.toUpperCase();
    var titleEl = document.getElementById('songTitle');
    if (titleEl) titleEl.textContent = 'Loading ' + currentPlaylist.name + '...';
    console.log('[RADIO] Switched to:', currentPlaylist.name);
  }
}

// === YOUTUBE API READY (must be global) ===
function onYouTubeIframeAPIReady() {
  console.log('[RADIO] YouTube API loaded');

  var playlistId = getPlaylistId(currentPlaylist.url);
  console.log('[RADIO] Playlist:', currentPlaylist.name, '| ID:', playlistId);

  player = new YT.Player('ytPlayer', {
    width: '100%',
    height: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      listType: 'playlist',
      list: playlistId
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onStateChange,
      onError: onError
    }
  });
}

// === PLAYER READY ===
function onPlayerReady(event) {
  playerReady = true;
  event.target.unMute();
  event.target.setVolume(volume);

  var el = document.getElementById('songTitle');
  if (el) el.textContent = 'Press Play to Begin';

  var status = document.getElementById('displayStatus');
  if (status) status.textContent = 'READY';

  var station = document.getElementById('displayStation');
  if (station) station.textContent = currentPlaylist.name.toUpperCase();

  var led = document.getElementById('ledGlow');
  if (led) led.classList.add('on');

  // Wait for playlist data
  var tries = 0;
  var waitPl = setInterval(function () {
    tries++;
    var pl = player.getPlaylist();
    if (pl && pl.length > 0) {
      clearInterval(waitPl);
      var numEl = document.getElementById('songNumber');
      if (numEl) numEl.textContent = '01 / ' + String(pl.length).padStart(2, '0');
      console.log('[RADIO] ✓ Ready!', pl.length, 'tracks');
    }
    if (tries > 20) clearInterval(waitPl);
  }, 500);
}

// === STATE CHANGE ===
function onStateChange(event) {
  switch (event.data) {
    case YT.PlayerState.PLAYING:
      isPlaying = true;
      updateUI();
      player.unMute();
      player.setVolume(volume);
      startProgress();
      setTimeout(function () {
        updateNowPlaying();
        // Rebuild playlist if panel is open or first time
        buildPlaylist();
      }, 800);
      break;

    case YT.PlayerState.PAUSED:
      isPlaying = false;
      updateUI();
      stopProgress();
      break;

    case YT.PlayerState.ENDED:
      isPlaying = false;
      updateUI();
      stopProgress();
      break;

    case YT.PlayerState.BUFFERING:
      var s = document.getElementById('displayStatus');
      if (s) s.textContent = 'BUFFERING';
      break;

    case YT.PlayerState.CUED:
      updateNowPlaying();
      break;
  }
}

// === ERROR ===
function onError(event) {
  console.warn('[RADIO] Error:', event.data, '— skipping');
  var el = document.getElementById('songTitle');
  if (el) el.textContent = 'Unavailable — Skipping...';
  setTimeout(function () {
    if (player && playerReady) {
      var pl = player.getPlaylist();
      if (pl && pl.length > 1) player.nextVideo();
    }
  }, 2000);
}

// === UPDATE NOW PLAYING ===
function updateNowPlaying() {
  if (!player || !playerReady) return;
  try {
    var data = player.getVideoData();
    var title = data.title || 'Unknown';
    var author = data.author || '';
    var idx = player.getPlaylistIndex() || 0;
    var pl = player.getPlaylist();
    var total = pl ? pl.length : 1;

    var titleEl = document.getElementById('songTitle');
    var artistEl = document.getElementById('songArtist');
    var numEl = document.getElementById('songNumber');
    var stationEl = document.getElementById('displayStation');
    var statusEl = document.getElementById('displayStatus');

    if (titleEl) titleEl.textContent = title;
    if (artistEl) artistEl.textContent = author;
    if (numEl) numEl.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0');
    if (stationEl) stationEl.textContent = "90'S HITS";
    if (statusEl) statusEl.textContent = 'NOW PLAYING';

    // Cache title
    trackTitles[idx] = title;

    // Move tuning needle
    var needle = document.getElementById('tuningNeedle');
    if (needle) needle.style.left = (15 + ((idx * 37 + 13) % 70)) + '%';

    // Update playlist highlight
    highlightPlaylistItem(idx);
  } catch (e) {
    console.warn('[RADIO] Display error:', e);
  }
}

// === UPDATE UI (play/pause state) ===
function updateUI() {
  var iconPlay = document.querySelector('.icon-play');
  var iconPause = document.querySelector('.icon-pause');
  var btnPlay = document.getElementById('btnPlay');
  var crtGlow = document.getElementById('crtGlow');
  var speaker = document.getElementById('speakerGrille');
  var speakerSection = speaker ? speaker.closest('.speaker-section') : null;

  if (isPlaying) {
    if (iconPlay) iconPlay.style.display = 'none';
    if (iconPause) iconPause.style.display = 'block';
    if (btnPlay) btnPlay.classList.add('is-playing');
    if (crtGlow) crtGlow.classList.add('active');
    if (speaker) speaker.classList.add('playing');
    if (speakerSection) speakerSection.classList.add('playing');
  } else {
    if (iconPlay) iconPlay.style.display = 'block';
    if (iconPause) iconPause.style.display = 'none';
    if (btnPlay) btnPlay.classList.remove('is-playing');
    if (crtGlow) crtGlow.classList.remove('active');
    if (speaker) speaker.classList.remove('playing');
    if (speakerSection) speakerSection.classList.remove('playing');
  }
}

// === PROGRESS ===
function startProgress() {
  stopProgress();
  progressTimer = setInterval(updateProgress, 1000);
}

function stopProgress() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

function updateProgress() {
  if (!player || !playerReady) return;
  try {
    var cur = player.getCurrentTime() || 0;
    var dur = player.getDuration() || 0;

    var curEl = document.getElementById('currentTime');
    var totEl = document.getElementById('totalTime');
    var barEl = document.getElementById('progressBar');
    var labelEl = document.getElementById('displayLabel');

    if (curEl) curEl.textContent = formatTime(cur);
    if (totEl) totEl.textContent = formatTime(dur);
    if (barEl && dur > 0) barEl.style.width = ((cur / dur) * 100) + '%';

    // Text progress bar
    if (labelEl && dur > 0) {
      var filled = Math.round((cur / dur) * 12);
      labelEl.textContent = '━'.repeat(filled) + '─'.repeat(12 - filled);
    }
  } catch (e) {}
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  var m = Math.floor(sec / 60);
  var s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// === PLAYLIST PANEL ===
function buildPlaylist() {
  if (!player || !playerReady) return;
  var pl = player.getPlaylist();
  var container = document.getElementById('playlistItems');
  if (!container) return;

  if (!pl || pl.length === 0) {
    container.innerHTML = '<div class="playlist-empty">Play a song first to load playlist</div>';
    // Auto-retry after 2 seconds
    setTimeout(function () {
      if (playlistOpen) buildPlaylist();
    }, 2000);
    return;
  }

  var idx = player.getPlaylistIndex() || 0;
  var html = '';
  for (var i = 0; i < pl.length; i++) {
    var num = String(i + 1).padStart(2, '0');
    var active = i === idx ? ' active' : '';
    var title = trackTitles[i] || 'Track ' + num;
    var thumb = 'https://img.youtube.com/vi/' + pl[i] + '/default.jpg';
    html += '<div class="playlist-item' + active + '" data-index="' + i + '" role="listitem">';
    html += '<img class="playlist-item-thumb" src="' + thumb + '" alt="" loading="lazy" />';
    html += '<div class="playlist-item-info">';
    html += '<span class="playlist-item-num">' + num + '</span>';
    html += '<span class="playlist-item-title">' + title + '</span>';
    html += '</div></div>';
  }
  container.innerHTML = html;

  // Click to play
  container.querySelectorAll('.playlist-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var i = parseInt(this.dataset.index, 10);
      if (player && playerReady) player.playVideoAt(i);
    });
  });

  // Fetch titles (free, no API key)
  pl.forEach(function (videoId, i) {
    if (trackTitles[i]) return;
    fetch('https://noembed.com/embed?url=https://www.youtube.com/watch?v=' + videoId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.title) {
          trackTitles[i] = data.title;
          var items = container.querySelectorAll('.playlist-item');
          if (items[i]) {
            var t = items[i].querySelector('.playlist-item-title');
            if (t) t.textContent = data.title;
          }
        }
      }).catch(function () {});
  });
}

function highlightPlaylistItem(activeIdx) {
  var container = document.getElementById('playlistItems');
  if (!container) return;
  var items = container.querySelectorAll('.playlist-item');
  items.forEach(function (item, i) {
    item.classList.toggle('active', i === activeIdx);
    if (trackTitles[i]) {
      var t = item.querySelector('.playlist-item-title');
      if (t) t.textContent = trackTitles[i];
    }
  });
}

// === DOM READY — EVENT LISTENERS ===
document.addEventListener('DOMContentLoaded', function () {
  console.log('[RADIO] DOM Ready');

  // --- PLAY ---
  document.getElementById('btnPlay').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!playerReady || !player) return;

    var state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) {
      player.pauseVideo();
    } else {
      // First: ensure unmuted and volume set
      player.unMute();
      player.setVolume(volume);
      // Play
      player.playVideo();

      // Fallback: if nothing happens in 2 sec, try muting first then unmuting
      // (workaround for some browsers)
      setTimeout(function () {
        var newState = player.getPlayerState();
        if (newState !== YT.PlayerState.PLAYING && newState !== YT.PlayerState.BUFFERING) {
          console.log('[RADIO] Retrying play...');
          player.mute();
          player.playVideo();
          setTimeout(function () {
            player.unMute();
            player.setVolume(volume);
          }, 500);
        }
      }, 2000);
    }
  });

  // --- NEXT ---
  document.getElementById('btnNext').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!playerReady || !player || !isPowerOn) return;
    if (isShuffleOn) {
      var pl = player.getPlaylist();
      if (pl && pl.length > 1) {
        var idx = Math.floor(Math.random() * pl.length);
        player.playVideoAt(idx);
      }
    } else {
      player.nextVideo();
    }
  });

  // --- PREV ---
  document.getElementById('btnPrev').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!playerReady || !player || !isPowerOn) return;
    player.previousVideo();
  });

  // --- SHUFFLE ---
  document.getElementById('btnShuffle').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    isShuffleOn = !isShuffleOn;
    this.classList.toggle('active', isShuffleOn);
    if (player && playerReady) player.setShuffle(isShuffleOn);
    var s = document.getElementById('displayStatus');
    if (s) s.textContent = isShuffleOn ? 'SHUFFLE ON' : 'SHUFFLE OFF';
    setTimeout(function () { if (isPlaying) updateNowPlaying(); }, 2000);
  });

  // --- PLAYLIST ---
  document.getElementById('btnPlaylist').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    playlistOpen = !playlistOpen;
    var panel = document.getElementById('playlistPanel');
    if (panel) panel.classList.toggle('open', playlistOpen);
    this.classList.toggle('active', playlistOpen);
    if (playlistOpen) buildPlaylist();
  });

  var closeBtn = document.getElementById('btnPlaylistClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      playlistOpen = false;
      var panel = document.getElementById('playlistPanel');
      if (panel) panel.classList.remove('open');
      document.getElementById('btnPlaylist').classList.remove('active');
    });
  }

  // --- CHANNEL SWITCH ---
  document.getElementById('btnChannel').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!isPowerOn) return;
    switchPlaylist();
  });

  // --- POWER ---
  document.getElementById('btnPower').addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    isPowerOn = !isPowerOn;
    var radio = document.getElementById('radio');
    var led = document.getElementById('ledGlow');
    this.classList.toggle('on', isPowerOn);

    if (isPowerOn) {
      if (radio) radio.classList.remove('off');
      if (led) led.classList.add('on');
    } else {
      if (radio) radio.classList.add('off');
      if (led) led.classList.remove('on');
      if (isPlaying && player) player.pauseVideo();
      stopProgress();
    }
  });

  // --- VOLUME SLIDER ---
  var volSlider = document.getElementById('volumeSlider');
  if (volSlider) {
    volSlider.addEventListener('input', function () {
      volume = parseInt(this.value, 10);
      if (player && playerReady) {
        player.setVolume(volume);
        player.unMute();
      }
      rotateKnob(volume);
    });
  }

  // --- VOLUME KNOB (drag) ---
  var knob = document.getElementById('volumeKnob');
  if (knob) {
    var dragging = false, startY = 0, startVol = 0;
    knob.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      dragging = true;
      startY = e.clientY;
      startVol = volume;
      document.addEventListener('pointermove', onKnobMove);
      document.addEventListener('pointerup', onKnobUp);
    });
    function onKnobMove(e) {
      if (!dragging) return;
      var delta = (startY - e.clientY) * 0.5;
      volume = Math.max(0, Math.min(100, Math.round(startVol + delta)));
      if (player && playerReady) { player.setVolume(volume); player.unMute(); }
      rotateKnob(volume);
      if (volSlider) volSlider.value = volume;
    }
    function onKnobUp() {
      dragging = false;
      document.removeEventListener('pointermove', onKnobMove);
      document.removeEventListener('pointerup', onKnobUp);
    }
    rotateKnob(volume);
  }

  function rotateKnob(vol) {
    var knobBody = document.querySelector('.knob-body');
    if (knobBody) {
      var angle = 30 + (vol / 100) * 300;
      knobBody.style.transform = 'rotate(' + angle + 'deg)';
    }
  }

  // --- PROGRESS SEEK ---
  var progTrack = document.getElementById('progressTrack');
  if (progTrack) {
    progTrack.addEventListener('click', function (e) {
      if (!player || !playerReady) return;
      var rect = this.getBoundingClientRect();
      var pct = (e.clientX - rect.left) / rect.width;
      var dur = player.getDuration();
      if (dur > 0) player.seekTo(pct * dur, true);
    });
  }

  // --- KEYBOARD ---
  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        document.getElementById('btnPlay').click();
        break;
      case 'ArrowRight':
        e.preventDefault();
        document.getElementById('btnNext').click();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        document.getElementById('btnPrev').click();
        break;
      case 'ArrowUp':
        e.preventDefault();
        volume = Math.min(100, volume + 10);
        if (player && playerReady) { player.setVolume(volume); player.unMute(); }
        rotateKnob(volume);
        if (volSlider) volSlider.value = volume;
        break;
      case 'ArrowDown':
        e.preventDefault();
        volume = Math.max(0, volume - 10);
        if (player && playerReady) { player.setVolume(volume); player.unMute(); }
        rotateKnob(volume);
        if (volSlider) volSlider.value = volume;
        break;
      case 'KeyS':
        e.preventDefault();
        document.getElementById('btnShuffle').click();
        break;
      case 'KeyP':
        e.preventDefault();
        document.getElementById('btnPlaylist').click();
        break;
      case 'KeyC':
        e.preventDefault();
        document.getElementById('btnChannel').click();
        break;
    }
  });

  console.log('[RADIO] ♫ TIME RADIO ready');
  console.log('[RADIO] Keyboard: Space ← → ↑ ↓ S P');

  // --- VIEW CODE MODAL ---
  var codeModal = document.getElementById('codeModal');
  var btnViewCode = document.getElementById('btnViewCode');
  var btnCloseCode = document.getElementById('btnCloseCode');

  if (btnViewCode && codeModal) {
    btnViewCode.addEventListener('click', function () {
      codeModal.classList.add('open');
    });
    btnCloseCode.addEventListener('click', function () {
      codeModal.classList.remove('open');
    });
    codeModal.addEventListener('click', function (e) {
      if (e.target === codeModal) codeModal.classList.remove('open');
    });
  }
});
