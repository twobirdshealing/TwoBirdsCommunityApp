class TbcBcSelector {
    constructor() {
        this.mainSwiper = null;
        this.thumbsSwiper = null;
        this.activeBookId = null;
        this.isTransitioning = false;

        this.init();
    }

    init() {
        if (!document.querySelector('.tbc-bc-selector')) {
            return;
        }

        this.initializeSwipers();
        this.initializeEventListeners();
        this.handleInitialState();
    }

    initializeSwipers() {
        this.thumbsSwiper = new Swiper('.tbc-bc-thumbs-swiper', {
            slidesPerView: 'auto',
            spaceBetween: 15,
            watchSlidesProgress: true,
            centerInsufficientSlides: true,
            slideToClickedSlide: true,
            breakpoints: {
                320: { slidesPerView: 3, spaceBetween: 10 },
                480: { slidesPerView: 4, spaceBetween: 15 },
                768: { slidesPerView: 5, spaceBetween: 20 },
                1024: { slidesPerView: 6, spaceBetween: 20 }
            }
        });

        this.mainSwiper = new Swiper('.tbc-bc-main-swiper', {
            spaceBetween: 30,
            effect: 'fade',
            fadeEffect: { crossFade: true },
            navigation: {
                nextEl: '.swiper-button-next',
                prevEl: '.swiper-button-prev',
            },
            thumbs: {
                swiper: this.thumbsSwiper,
                autoScrollOffset: 1
            },
            autoHeight: true,
            speed: 500
        });
    }

    initializeEventListeners() {
        document.querySelectorAll('.tbc-bc-listen-button').forEach(button => {
            button.addEventListener('click', (e) => this.handleListenClick(e));
        });

        window.addEventListener('popstate', (e) => this.handlePopState(e));

        this.mainSwiper.on('slideChangeTransitionStart', () => {
            const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
            activeSlide.querySelector('.tbc-bc-preview').classList.add('tbc-bc-slide-changing');
        });

        this.mainSwiper.on('slideChangeTransitionEnd', () => {
            document.querySelectorAll('.tbc-bc-preview').forEach(preview => {
                preview.classList.remove('tbc-bc-slide-changing');
            });
        });

        document.addEventListener('keydown', (e) => {
            if (document.querySelector('.tbc-bc-selector').style.display !== 'none') {
                if (e.key === 'ArrowRight') {
                    this.mainSwiper.slideNext();
                } else if (e.key === 'ArrowLeft') {
                    this.mainSwiper.slidePrev();
                }
            }
        });
    }

    async handleListenClick(e) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        const button = e.currentTarget;
        const bookId = button.dataset.bookId;
        
        try {
            button.classList.add('tbc-bc-loading');
            
            const response = await this.loadPlayer(bookId);
            if (!response.ok) throw new Error('Failed to load player');
            const html = await response.text();

            this.switchToPlayer(html, bookId);
            this.updateURL(bookId);
            
        } catch (error) {
            console.error('Error loading player:', error);
            this.showError('Failed to load the audio player. Please try again.');
        } finally {
            button.classList.remove('tbc-bc-loading');
            this.isTransitioning = false;
        }
    }

    loadPlayer(bookId) {
        return fetch(`${tbcBcSelector.ajaxurl}?action=tbc_bc_load_player&book_id=${bookId}&nonce=${tbcBcSelector.nonce}`, {
            method: 'GET',
            credentials: 'same-origin'
        });
    }

    switchToPlayer(html, bookId) {
        const playerContainer = document.querySelector('.tbc-bc-player-container');
        const selectorContainer = document.querySelector('.tbc-bc-selector');

        selectorContainer.style.opacity = '0';
        
        setTimeout(() => {
            selectorContainer.style.display = 'none';
            playerContainer.innerHTML = html;
            playerContainer.style.display = 'block';
            playerContainer.style.opacity = '0';

            new TbcBcPlayer();

            setTimeout(() => {
                playerContainer.style.opacity = '1';
            }, 50);
        }, 300);

        this.activeBookId = bookId;
    }

    switchToSelector() {
        const playerContainer = document.querySelector('.tbc-bc-player-container');
        const selectorContainer = document.querySelector('.tbc-bc-selector');

        playerContainer.style.opacity = '0';
        
        setTimeout(() => {
            playerContainer.style.display = 'none';
            selectorContainer.style.display = 'block';
            selectorContainer.style.opacity = '0';

            setTimeout(() => {
                selectorContainer.style.opacity = '1';
            }, 50);
        }, 300);

        this.activeBookId = null;
    }

    handleInitialState() {
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('book_id');

        if (bookId) {
            const listenButton = document.querySelector(`[data-book-id="${bookId}"]`);
            if (listenButton) {
                listenButton.click();
            }
        }
    }

    handlePopState(e) {
        const urlParams = new URLSearchParams(window.location.search);
        const bookId = urlParams.get('book_id');

        if (!bookId && this.activeBookId) {
            this.switchToSelector();
        } else if (bookId && bookId !== this.activeBookId) {
            const listenButton = document.querySelector(`[data-book-id="${bookId}"]`);
            if (listenButton) {
                listenButton.click();
            }
        }
    }

    updateURL(bookId) {
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('book_id', bookId);
        window.history.pushState({ bookId }, '', newUrl);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tbc-bc-error';
        errorDiv.textContent = message;
        
        document.querySelector('.tbc-bc-selector').appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new TbcBcSelector();
});