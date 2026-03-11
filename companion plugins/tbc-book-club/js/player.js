class TbcBcPlayer {
    constructor() {
        this.currentBookId = null;
        this.chapters = [];
        this.currentChapterIndex = 0;
        this.plyr = null;
        this.activeControl = null;

        this.container = document.querySelector('.tbc-bc-player');
        if (!this.container) return;

        this.currentBookId = this.container.dataset.bookId;
        if (!this.currentBookId) return;

        const chapterItems = this.container.querySelectorAll('.tbc-bc-chapter-item');
        this.chapters = Array.from(chapterItems).map(item => {
            const chapterContent = item.querySelector('.tbc-bc-chapter-content');
            const label = chapterContent.querySelector('.tbc-bc-chapter-label');
            const chapterTitle = chapterContent.querySelector('.tbc-bc-chapter-title');
            
            return {
                title: chapterTitle ? chapterTitle.textContent : '',
                time: parseFloat(item.dataset.time),
                label: label ? label.textContent : ''
            };
        });

        this.cacheUIElements();
        this.initializePlyr();
        this.bindMethods();
        this.setupEventListeners();
    }

    cacheUIElements() {
        this.progressBar = this.container.querySelector('.tbc-bc-progress-bar');
        this.progressPlayed = this.container.querySelector('.tbc-bc-progress-played');
        this.progressLoaded = this.container.querySelector('.tbc-bc-progress-loaded');
        this.progressSeek = this.container.querySelector('.tbc-bc-progress-seek');
        
        this.currentTimeDisplay = this.container.querySelector('.tbc-bc-current-time');
        this.timeRemainingDisplay = this.container.querySelector('.tbc-bc-time-remaining');
        
        this.chapterContent = this.container.querySelector('.tbc-bc-chapter-content');
        
        this.playButton = this.container.querySelector('.tbc-bc-play-large');
        this.toolbar = this.container.querySelector('.tbc-bc-player-toolbar');
        this.volumeSlider = this.container.querySelector('.tbc-bc-volume-slider');
        this.volumeToggle = this.container.querySelector('.tbc-bc-volume-toggle');
        this.speedOptions = this.container.querySelectorAll('.tbc-bc-speed-option');
        this.speedIndicator = this.container.querySelector('.tbc-bc-speed-indicator');
        
        this.chaptersControls = this.container.querySelector('.tbc-bc-chapters-controls');
        this.bookmarkControls = this.container.querySelector('.tbc-bc-bookmark-controls');
        this.chaptersToggle = this.container.querySelector('.tbc-bc-chapters-toggle');
        this.bookmarkToggle = this.container.querySelector('.tbc-bc-bookmark-toggle');
        
        this.messagesContainer = this.container.querySelector('.tbc-bc-messages-container');
    }

    bindMethods() {
        this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
        this.handleProgressClick = this.handleProgressClick.bind(this);
        this.handlePlayClick = this.handlePlayClick.bind(this);
        this.handleSkip = this.handleSkip.bind(this);
        this.handleChapterSkip = this.handleChapterSkip.bind(this);
        this.handleBookmark = this.handleBookmark.bind(this);
        this.handleChapterJump = this.handleChapterJump.bind(this);
        this.handleBookmarkJump = this.handleBookmarkJump.bind(this);
        this.handleRemoveBookmark = this.handleRemoveBookmark.bind(this);
        this.handleToolbarClick = this.handleToolbarClick.bind(this);
        this.handleVolumeChange = this.handleVolumeChange.bind(this);
        this.handleSpeedChange = this.handleSpeedChange.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    handlePlayError(error, context = 'Playback') {
        if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
            console.error(`${context} error:`, error);
            this.showMessage(`${context} error: ${error.message}`, 'error');
        }
    }

    findChapterByTime(currentTime) {
        if (!this.chapters.length) return -1;
        
        return this.chapters.findIndex((chapter, index) => {
            const nextChapterTime = index < this.chapters.length - 1 
                ? this.chapters[index + 1].time 
                : Infinity;
            return currentTime >= chapter.time && currentTime < nextChapterTime;
        });
    }

    updateChapterDisplay(chapterIndex = this.currentChapterIndex) {
        if (!this.chapterContent || this.chapters.length === 0) return;
        
        const currentChapter = this.chapters[chapterIndex];
        const fullText = this.getChapterDisplayText(currentChapter);
        this.chapterContent.innerHTML = `${fullText} &nbsp;|&nbsp; ${fullText}`;
    }

    highlightActiveChapter(chapterIndex = this.currentChapterIndex) {
        this.container.querySelectorAll('.tbc-bc-chapter-item').forEach((item, index) => {
            item.classList.toggle('tbc-bc-active', index === chapterIndex);
            if (index === chapterIndex && this.activeControl === 'chapters') {
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    }

    updatePlayerUI(state = {}) {
        const { playing, chapterIndex } = state;
        
        if (playing !== undefined) {
            this.updatePlayButton(playing);
        }
        
        if (chapterIndex !== undefined && chapterIndex !== this.currentChapterIndex) {
            this.currentChapterIndex = chapterIndex;
            this.updateChapterDisplay(chapterIndex);
            this.highlightActiveChapter(chapterIndex);
        }
    }

    getChapterDisplayText(chapter) {
        return `${chapter.label} - ${chapter.title}`;
    }

    initializePlyr() {
        const audioElement = document.getElementById('tbc-bc-audio');
        if (!audioElement) return;

        const currentBook = {
            title: this.container.querySelector('.tbc-bc-book-title')?.textContent || 'Audiobook',
            author: this.container.querySelector('.tbc-bc-book-author')?.textContent || 'Unknown Author',
            cover: this.container.querySelector('.tbc-bc-book-cover img')?.src || null
        };

        this.plyr = new Plyr(audioElement, {
            controls: [],
            keyboard: { focused: true, global: false },
            storage: { enabled: true, key: 'tbc_bc_plyr' },
            mediaMetadata: {
                title: currentBook.title,
                artist: currentBook.author,
                artwork: currentBook.cover ? [
                    { src: currentBook.cover, sizes: '300x300', type: 'image/jpeg' }
                ] : []
            }
        });

        this.plyr.elements.container.classList.add('tbc-bc-plyr');
        this.setPlayMessage();
    }

    static backToBooks() {
        const baseUrl = window.location.href.split('?')[0];
        window.location.href = baseUrl;
    }

    setPlayMessage() {
        if (this.chapterContent) {
            const message = "Please press play to start";
            this.chapterContent.innerHTML = `${message} &nbsp;|&nbsp; ${message}`;
        }
    }

    syncChapterWithCurrentTime() {
        const newChapterIndex = this.findChapterByTime(this.plyr.currentTime);
        
        if (newChapterIndex !== -1) {
            this.updatePlayerUI({ chapterIndex: newChapterIndex });
        } else if (this.plyr.currentTime < 1) {
            this.updatePlayerUI({ chapterIndex: 0 });
        }
    }

    setupEventListeners() {
        if (this.progressBar) {
            this.progressBar.addEventListener('click', this.handleProgressClick);
            this.progressSeek.addEventListener('input', (e) => {
                const time = (e.target.value / 100) * this.plyr.duration;
                this.plyr.currentTime = time;
            });
        }

        if (this.playButton) {
            this.playButton.addEventListener('click', this.handlePlayClick);
        }

        this.container.querySelectorAll('.tbc-bc-skip-button').forEach(button => {
            button.addEventListener('click', this.handleSkip);
        });

        this.container.querySelectorAll('.tbc-bc-chapter-skip').forEach(button => {
            button.addEventListener('click', this.handleChapterSkip);
        });

        this.container.querySelectorAll('.tbc-bc-chapter-item').forEach(item => {
            item.addEventListener('click', this.handleChapterJump);
        });

        if (this.toolbar) {
            this.toolbar.addEventListener('click', this.handleToolbarClick);
        }

        if (this.volumeSlider) {
            this.volumeSlider.addEventListener('input', this.handleVolumeChange);
        }

        this.speedOptions.forEach(option => {
            option.addEventListener('click', this.handleSpeedChange);
        });

        const bookmarkForm = this.container.querySelector('.tbc-bc-bookmark-form');
        if (bookmarkForm) {
            bookmarkForm.addEventListener('submit', this.handleBookmark);
        }

        this.container.querySelectorAll('.tbc-bc-bookmark-jump').forEach(btn => {
            btn.addEventListener('click', this.handleBookmarkJump);
        });

        this.container.querySelectorAll('.tbc-bc-remove-bookmark').forEach(btn => {
            btn.addEventListener('click', this.handleRemoveBookmark);
        });

        document.addEventListener('click', this.handleClickOutside);

        this.plyr.on('timeupdate', this.handleTimeUpdate);
        this.plyr.on('progress', () => this.updateLoadProgress());
        this.plyr.on('playing', () => {
            this.updatePlayerUI({ playing: true });
            this.syncChapterWithCurrentTime();
        });
        this.plyr.on('pause', () => {
            this.updatePlayerUI({ playing: false });
        });
        this.plyr.on('ended', () => {
            this.updatePlayerUI({ playing: false });
            this.handleChapterSkip({ currentTarget: this.container.querySelector('.tbc-bc-next-chapter') });
        });
        this.plyr.on('error', (event) => {
            console.error('Plyr error event:', event);
            this.showMessage('Audio playback error occurred', 'error');
        });

        this.initializeControls();
    }

    initializeControls() {
        setTimeout(() => {
            this.updateVolumeControls();
            this.updateSpeedControls();
        }, 100);
        
        this.plyr.on('playing', () => {
            this.updateVolumeControls();
        });
    }

    updateVolumeControls() {
        if (this.volumeSlider) {
            this.volumeSlider.value = this.plyr.volume;
        }
        this.updateVolumeIcon(this.plyr.volume);
    }

    updateSpeedControls() {
        this.speedOptions.forEach(option => {
            const isActive = parseFloat(option.dataset.speed) === this.plyr.speed;
            option.classList.toggle('tbc-bc-active', isActive);
        });
        this.updateSpeedIndicator();
    }

    updateSpeedIndicator(speed = null) {
        if (this.speedIndicator) {
            const currentSpeed = speed !== null ? speed : this.plyr.speed;
            this.speedIndicator.textContent = `${currentSpeed}x`;
        }
    }

    handleToolbarClick(e) {
        const button = e.target.closest('.tbc-bc-toolbar-button');
        if (!button) return;

        const controlType = button.classList.contains('tbc-bc-bookmark-toggle') ? 'bookmark' :
                          button.classList.contains('tbc-bc-volume-toggle') ? 'volume' :
                          button.classList.contains('tbc-bc-speed-toggle') ? 'speed' :
                          button.classList.contains('tbc-bc-chapters-toggle') ? 'chapters' : null;

        if (!controlType) return;

        const isActive = button.classList.contains('tbc-bc-active');
        this.toolbar.querySelectorAll('.tbc-bc-toolbar-button').forEach(btn => {
            btn.classList.remove('tbc-bc-active');
        });

        if (!isActive) {
            button.classList.add('tbc-bc-active');
            this.activeControl = controlType;
        } else {
            this.activeControl = null;
        }

        const controls = this.container.querySelectorAll('.tbc-bc-expandable-controls > div');
        controls.forEach(control => {
            const isTarget = control.classList.contains(`tbc-bc-${controlType}-controls`);
            control.classList.toggle('tbc-bc-active', isTarget && !isActive);
        });
    }

    handleClickOutside(e) {
        if (!this.activeControl) return;
        
        if (!this.container.contains(e.target)) {
            this.closeActiveControl();
        }
    }

    closeActiveControl() {
        if (this.activeControl) {
            this.container.querySelector(`.tbc-bc-${this.activeControl}-controls`)?.classList.remove('tbc-bc-active');
            this.container.querySelector(`.tbc-bc-${this.activeControl}-toggle`)?.classList.remove('tbc-bc-active');
            this.activeControl = null;
        }
    }

    handleVolumeChange(e) {
        const volume = parseFloat(e.target.value);
        this.plyr.volume = volume;
        this.updateVolumeIcon(volume);
    }

    updateVolumeIcon(volume) {
        if (!this.volumeToggle) return;
        this.volumeToggle.classList.toggle('tbc-bc-muted', volume === 0);
    }

    handleSpeedChange(e) {
        const speedOption = e.target.closest('.tbc-bc-speed-option');
        if (!speedOption) return;

        const speed = parseFloat(speedOption.dataset.speed);
        this.plyr.speed = speed;

        this.speedOptions.forEach(option => {
            option.classList.toggle('tbc-bc-active', option === speedOption);
        });

        this.updateSpeedIndicator(speed);
    }

    handleTimeUpdate() {
        const currentTime = this.plyr.currentTime;
        const duration = this.plyr.duration;
        
        this.updateProgressDisplay(currentTime, duration);
        this.updateTimeDisplays(currentTime, duration);
        this.updateCurrentChapter(currentTime);
    }

    updateProgressDisplay(currentTime, duration) {
        if (duration) {
            const percent = (currentTime / duration) * 100;
            this.progressPlayed.style.width = `${percent}%`;
            this.progressSeek.value = percent;
        }
    }

    updateTimeDisplays(currentTime, duration) {
        this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        
        if (duration) {
            const remaining = duration - currentTime;
            this.timeRemainingDisplay.textContent = '-' + this.formatTime(remaining);
        }
    }

    updateCurrentChapter(currentTime) {
        const newChapterIndex = this.findChapterByTime(currentTime);
        
        if (newChapterIndex !== -1) {
            this.updatePlayerUI({ chapterIndex: newChapterIndex });
        }
    }

    updateLoadProgress() {
        const buffered = this.plyr.buffered;
        if (buffered.length) {
            const loaded = buffered.end(buffered.length - 1);
            const duration = this.plyr.duration;
            const percent = (loaded / duration) * 100;
            this.progressLoaded.style.width = `${percent}%`;
        }
    }

    handleProgressClick(e) {
        const bounds = this.progressBar.getBoundingClientRect();
        const x = e.clientX - bounds.left;
        const percent = x / bounds.width;
        this.plyr.currentTime = percent * this.plyr.duration;
    }

    handlePlayClick() {
        if (this.plyr.playing) {
            this.plyr.pause();
        } else {
            const playPromise = this.plyr.play();
            
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(error => this.handlePlayError(error, 'Play'));
            }
        }
    }

    updatePlayButton(playing) {
        if (this.playButton) {
            const playIcon = this.playButton.querySelector('.tbc-bc-play-icon');
            const pauseIcon = this.playButton.querySelector('.tbc-bc-pause-icon');
            
            playIcon.style.display = playing ? 'none' : 'block';
            pauseIcon.style.display = playing ? 'block' : 'none';
            this.playButton.setAttribute('title', playing ? 'Pause' : 'Play');

            if (this.chapterContent) {
                if (playing && this.chapters.length > 0) {
                    this.updateChapterDisplay();
                } else {
                    this.setPlayMessage();
                }
            }
        }
    }

    handleSkip(e) {
        const button = e.currentTarget;
        const skipTime = button.classList.contains('tbc-bc-forward-30') ? 30 : -30;
        this.plyr.currentTime += skipTime;

        const icon = button.querySelector('.tbc-bc-skip-icon');
        icon.classList.add('tbc-bc-rotating');
        
        icon.addEventListener('animationend', () => {
            icon.classList.remove('tbc-bc-rotating');
        }, { once: true });
    }

    handleChapterSkip(e) {
        const button = e.currentTarget;
        const isNext = button.classList.contains('tbc-bc-next-chapter');
        
        let newIndex = this.currentChapterIndex;
        if (isNext && newIndex < this.chapters.length - 1) {
            newIndex++;
        } else if (!isNext && newIndex > 0) {
            newIndex--;
        }

        if (newIndex !== this.currentChapterIndex) {
            this.plyr.currentTime = this.chapters[newIndex].time;
            this.updatePlayerUI({ chapterIndex: newIndex });
        }
    }

    handleChapterJump(e) {
        const time = parseFloat(e.currentTarget.dataset.time);
        if (!isNaN(time)) {
            this.plyr.currentTime = time;
            
            if (!this.plyr.playing) {
                const playPromise = this.plyr.play();
                
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(error => this.handlePlayError(error, 'Chapter jump'));
                }
            }
            
            this.closeActiveControl();
        }
    }

    handleBookmark(e) {
        e.preventDefault();
        const currentTime = this.plyr.currentTime;
        const form = e.target;
        const titleInput = form.querySelector('.tbc-bc-bookmark-title-input');
        const title = titleInput ? titleInput.value.trim() : '';

        jQuery.post(tbcBcPlayer.ajaxurl, {
            action: 'tbc_bc_save_bookmark',
            nonce: tbcBcPlayer.nonce,
            book_id: this.currentBookId,
            timestamp: currentTime,
            title: title
        })
        .done(response => {
            if (response.success) {
                this.addBookmarkToUI(response.data.bookmark_id, currentTime, title);
                if (titleInput) titleInput.value = '';
                this.showMessage('Bookmark added', 'success');
            } else {
                this.showMessage(response.data || 'Error adding bookmark', 'error');
            }
        })
        .fail(() => {
            this.showMessage('Error adding bookmark', 'error');
        });
    }
    
    addBookmarkToUI(bookmarkId, timestamp, title = '') {
        const bookmarksList = this.container.querySelector('.tbc-bc-bookmarks-list');
        if (!bookmarksList) return;

        const bookmarkItem = document.createElement('div');
        bookmarkItem.className = 'tbc-bc-bookmark-item';
        bookmarkItem.dataset.time = timestamp;
        
        bookmarkItem.innerHTML = `
            <button class="tbc-bc-bookmark-jump">
                <span class="tbc-bc-bookmark-icon">
                    <span class="dashicons dashicons-flag"></span>
                </span>
                <span class="tbc-bc-bookmark-title">${title || '(Untitled)'}</span>
                <span class="tbc-bc-bookmark-timestamp">${this.formatTime(timestamp)}</span>
            </button>
            <button class="tbc-bc-remove-bookmark" data-id="${bookmarkId}" title="Remove Bookmark">
                <span class="dashicons dashicons-no-alt"></span>
            </button>
        `;

        bookmarkItem.querySelector('.tbc-bc-bookmark-jump').addEventListener('click', this.handleBookmarkJump);
        bookmarkItem.querySelector('.tbc-bc-remove-bookmark').addEventListener('click', this.handleRemoveBookmark);

        bookmarksList.insertBefore(bookmarkItem, bookmarksList.firstChild);
    }

    handleBookmarkJump(e) {
        const bookmarkItem = e.currentTarget.closest('.tbc-bc-bookmark-item');
        if (bookmarkItem) {
            const time = parseFloat(bookmarkItem.dataset.time);
            if (!isNaN(time)) {
                this.plyr.currentTime = time;
                
                if (!this.plyr.playing) {
                    const playPromise = this.plyr.play();
                    
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(error => this.handlePlayError(error, 'Bookmark jump'));
                    }
                }
            }
        }
    }

    handleRemoveBookmark(e) {
        const button = e.currentTarget;
        const bookmarkId = button.dataset.id;
        const bookmarkItem = button.closest('.tbc-bc-bookmark-item');

        if (!bookmarkId || !bookmarkItem) return;

        jQuery.post(tbcBcPlayer.ajaxurl, {
            action: 'tbc_bc_remove_bookmark',
            nonce: tbcBcPlayer.nonce,
            bookmark_id: bookmarkId
        })
        .done(response => {
            if (response.success) {
                bookmarkItem.remove();
                this.showMessage('Bookmark removed', 'success');
            } else {
                this.showMessage(response.data || 'Error removing bookmark', 'error');
            }
        })
        .fail(() => {
            this.showMessage('Error removing bookmark', 'error');
        });
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showMessage(message, type = 'info') {
        if (!this.messagesContainer) return;

        const messageElement = document.createElement('div');
        messageElement.className = `tbc-bc-message tbc-bc-${type}`;
        messageElement.textContent = message;

        this.messagesContainer.appendChild(messageElement);

        setTimeout(() => {
            messageElement.classList.add('tbc-bc-fade-out');
            setTimeout(() => messageElement.remove(), 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TbcBcPlayer();
});