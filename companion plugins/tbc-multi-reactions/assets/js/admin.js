/**
 * TBC Multi Reactions - Admin JS
 *
 * 6 fixed reaction types — no add/delete, only edit and reorder.
 */
(function($) {
    'use strict';

    var currentCard = null; // card element being edited
    var colorPickerInited = false;

    $(document).ready(function() {

        // Sortable card grid
        $('#tbc-mr-reactions-grid').sortable({
            items: '.tbc-mr-card',
            placeholder: 'tbc-mr-card ui-sortable-placeholder',
            tolerance: 'pointer',
            update: function() {
                updateOrder();
            }
        });

        // --- Card interactions ---

        // Edit button click
        $(document).on('click', '.tbc-mr-card-edit', function(e) {
            e.stopPropagation();
            var $card = $(this).closest('.tbc-mr-card');
            openModal($card);
        });

        // Card click (not on edit button)
        $(document).on('click', '.tbc-mr-card', function(e) {
            if ($(e.target).closest('.tbc-mr-card-edit').length) return;
            openModal($(this));
        });

        // --- Modal ---

        function openModal($card) {
            currentCard = $card;

            var name = $card.find('.tbc-mr-data-name').val() || '';
            var emoji = $card.find('.tbc-mr-data-emoji').val() || '';
            var color = $card.find('.tbc-mr-data-color').val() || '#1877F2';
            var mediaId = $card.find('.tbc-mr-data-media-id').val() || '0';
            var iconUrl = $card.find('.tbc-mr-data-icon-url').val() || '';
            var enabled = $card.find('.tbc-mr-data-enabled').val() === '1';

            // Populate modal fields
            $('#tbc-mr-modal-name').val(name);
            $('#tbc-mr-modal-emoji').val(emoji);
            $('#tbc-mr-modal-enabled').prop('checked', enabled);
            updateCharCount(name.length);

            // Color picker
            if (!colorPickerInited) {
                $('#tbc-mr-modal-color').wpColorPicker({
                    change: function(event, ui) {
                        setTimeout(function() { updateModalPreview(); }, 50);
                    }
                });
                colorPickerInited = true;
            }
            $('#tbc-mr-modal-color').wpColorPicker('color', color);

            // Set active tab based on what the reaction has
            if (iconUrl && mediaId !== '0') {
                switchTab('custom');
            } else {
                switchTab('emoji');
            }

            // Upload preview
            if (iconUrl && mediaId !== '0') {
                $('#tbc-mr-upload-preview').html('<img src="' + iconUrl + '" alt="" />');
                $('#tbc-mr-modal-remove-icon').show();
                $('#tbc-mr-modal-upload').text('Change Icon');
            } else {
                $('#tbc-mr-upload-preview').html('<span class="tbc-mr-upload-placeholder">No custom icon</span>');
                $('#tbc-mr-modal-remove-icon').hide();
                $('#tbc-mr-modal-upload').text('Upload Icon');
            }

            updateModalPreview();
            $('#tbc-mr-modal').show();
        }

        function closeModal() {
            $('#tbc-mr-modal').hide();
            currentCard = null;
        }

        // Modal close
        $('.tbc-mr-modal-close, .tbc-mr-modal-overlay').on('click', function() {
            closeModal();
        });

        // Modal Save (Done)
        $('#tbc-mr-modal-save').on('click', function() {
            if (!currentCard) return;

            var name = $('#tbc-mr-modal-name').val().trim();
            var emoji = $('#tbc-mr-modal-emoji').val().trim();
            var color = $('#tbc-mr-modal-color').wpColorPicker('color');
            var enabled = $('#tbc-mr-modal-enabled').is(':checked');

            // Read current upload state from modal
            var mediaId = currentCard.find('.tbc-mr-data-media-id').val();
            var iconUrl = currentCard.find('.tbc-mr-data-icon-url').val();

            // Update hidden fields
            currentCard.find('.tbc-mr-data-name').val(name);
            currentCard.find('.tbc-mr-data-emoji').val(emoji);
            currentCard.find('.tbc-mr-data-color').val(color);
            currentCard.find('.tbc-mr-data-enabled').val(enabled ? '1' : '0');

            // Update card visual
            var $icon = currentCard.find('.tbc-mr-card-icon');
            if (iconUrl && mediaId !== '0') {
                $icon.html('<img src="' + iconUrl + '" alt="" />');
            } else if (emoji) {
                $icon.html('<span class="tbc-mr-card-emoji">' + emoji + '</span>');
            } else {
                $icon.html('<span class="tbc-mr-card-empty">?</span>');
            }

            currentCard.find('.tbc-mr-card-name').text(name);

            // Update enabled state
            var $badge = currentCard.find('.tbc-mr-card-badge');
            if (enabled) {
                currentCard.removeClass('tbc-mr-card-disabled');
                $badge.removeClass('tbc-mr-badge-off').addClass('tbc-mr-badge-on');
            } else {
                currentCard.addClass('tbc-mr-card-disabled');
                $badge.removeClass('tbc-mr-badge-on').addClass('tbc-mr-badge-off');
            }

            closeModal();
            updateLivePreview();
        });

        // --- Tabs ---

        $(document).on('click', '.tbc-mr-tab', function() {
            switchTab($(this).data('tab'));
        });

        function switchTab(tab) {
            $('.tbc-mr-tab').removeClass('tbc-mr-tab-active');
            $('.tbc-mr-tab[data-tab="' + tab + '"]').addClass('tbc-mr-tab-active');
            $('.tbc-mr-tab-content').removeClass('tbc-mr-tab-visible');
            $('.tbc-mr-tab-' + tab).addClass('tbc-mr-tab-visible');
        }

        // --- Emoji input ---

        $('#tbc-mr-modal-emoji').on('input', function() {
            updateModalPreview();
        });

        // --- Name input ---

        $('#tbc-mr-modal-name').on('input', function() {
            var len = $(this).val().length;
            updateCharCount(len);
            updateModalPreview();
        });

        function updateCharCount(len) {
            $('#tbc-mr-char-count').text(len + '/12');
        }

        // --- Upload Icon ---

        // Shared upload function (accepts FormData with icon_file)
        function doUpload(formData) {
            var $btn = $('#tbc-mr-modal-upload');
            $btn.prop('disabled', true).text('Uploading...');

            $.ajax({
                url: tbcMrAdmin.ajaxUrl,
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false,
                success: function(response) {
                    if (response.success && currentCard) {
                        currentCard.find('.tbc-mr-data-media-id').val(response.data.media_id);
                        currentCard.find('.tbc-mr-data-icon-url').val(response.data.url);

                        $('#tbc-mr-upload-preview').html('<img src="' + response.data.url + '" alt="" />');
                        $('#tbc-mr-modal-remove-icon').show();
                        $btn.text('Change Icon');
                        updateModalPreview();
                    } else {
                        alert(response.data || 'Upload failed.');
                    }
                },
                error: function() {
                    alert('Upload failed. Please try again.');
                },
                complete: function() {
                    $btn.prop('disabled', false);
                }
            });
        }

        // Upload button click
        $('#tbc-mr-modal-upload').on('click', function() {
            var $fileInput = $('<input type="file" accept="image/png,image/svg+xml,image/gif,image/webp,image/jpeg" style="display:none;">');
            $('body').append($fileInput);

            $fileInput.on('change', function() {
                var file = this.files[0];
                if (!file) { $fileInput.remove(); return; }

                var allowed = ['image/png', 'image/svg+xml', 'image/gif', 'image/webp', 'image/jpeg'];
                if (allowed.indexOf(file.type) === -1) {
                    alert('Invalid file type. Allowed: PNG, JPG, SVG, GIF, WEBP.');
                    $fileInput.remove();
                    return;
                }

                if (file.size > 2097152) {
                    alert('File too large. Maximum size: 2MB.');
                    $fileInput.remove();
                    return;
                }

                var formData = new FormData();
                formData.append('action', 'tbc_mr_upload_icon');
                formData.append('nonce', tbcMrAdmin.nonce);
                formData.append('icon_file', file);
                doUpload(formData);

                $fileInput.remove();
            });

            $fileInput.trigger('click');
        });

        // Remove icon
        $('#tbc-mr-modal-remove-icon').on('click', function() {
            if (!currentCard) return;

            currentCard.find('.tbc-mr-data-media-id').val('0');
            currentCard.find('.tbc-mr-data-icon-url').val('');

            $('#tbc-mr-upload-preview').html('<span class="tbc-mr-upload-placeholder">No custom icon</span>');
            $(this).hide();
            $('#tbc-mr-modal-upload').text('Upload Icon');
            updateModalPreview();
        });

        // --- Modal Preview ---

        function updateModalPreview() {
            var emoji = $('#tbc-mr-modal-emoji').val() || '';
            var name = $('#tbc-mr-modal-name').val() || '';
            var iconUrl = currentCard ? currentCard.find('.tbc-mr-data-icon-url').val() : '';
            var mediaId = currentCard ? currentCard.find('.tbc-mr-data-media-id').val() : '0';

            var $icon = $('#tbc-mr-modal-preview-icon');
            if (iconUrl && mediaId !== '0') {
                $icon.html('<img src="' + iconUrl + '" alt="" />');
            } else if (emoji) {
                $icon.html(emoji);
            } else {
                $icon.html('<span style="color:#ccc;font-size:24px">?</span>');
            }

            $('#tbc-mr-modal-preview-name').text(name);
        }

        // --- Helpers ---

        function updateOrder() {
            $('.tbc-mr-card').each(function(i) {
                $(this).find('.tbc-mr-order').val(i + 1);
            });
        }

        // ESC key closes modal
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && $('#tbc-mr-modal').is(':visible')) {
                closeModal();
            }
        });

    });
})(jQuery);
