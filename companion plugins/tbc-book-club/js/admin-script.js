jQuery(document).ready(function($) {
    
    // ===================
    // Tab Navigation
    // ===================
    
    $('.tbc-bc-tab').on('click', function() {
        const tabId = $(this).data('tab');
        
        $('.tbc-bc-tab').removeClass('tbc-bc-tab-active');
        $(this).addClass('tbc-bc-tab-active');
        
        $('.tbc-bc-tab-panel').removeClass('tbc-bc-tab-panel-active');
        $(`.tbc-bc-tab-panel[data-panel="${tabId}"]`).addClass('tbc-bc-tab-panel-active');
    });

    $(document).on('click', '[data-goto-tab]', function() {
        const tabId = $(this).data('goto-tab');
        $(`.tbc-bc-tab[data-tab="${tabId}"]`).trigger('click');
    });

    // ===================
    // Utility Functions
    // ===================
    
    function tbcBcValidateTimeFormat(timeStr) {
        return /^[0-9]{1,2}:[0-5][0-9]:[0-5][0-9]$/.test(timeStr);
    }

    function tbcBcEscapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }

    function tbcBcParseChapterRange(rangeStr) {
        rangeStr = rangeStr.trim();
        if (!rangeStr) return null;
        
        if (rangeStr.includes('-')) {
            const parts = rangeStr.split('-').map(s => parseInt(s.trim(), 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                return { start: parts[0], end: parts[1] };
            }
        } else {
            const num = parseInt(rangeStr, 10);
            if (!isNaN(num)) {
                return { start: num, end: num };
            }
        }
        return null;
    }

    function tbcBcValidateChapterRange(rangeStr, totalChapters) {
        const range = tbcBcParseChapterRange(rangeStr);
        if (!range) return { valid: false, error: 'Invalid format. Use: 1-7 or 5' };
        if (range.start < 1) return { valid: false, error: 'Chapter must be at least 1' };
        if (range.end > totalChapters) return { valid: false, error: `Max chapter is ${totalChapters}` };
        if (range.start > range.end) return { valid: false, error: 'Start must be <= end' };
        return { valid: true, range: range };
    }

    // ===================
    // Chapter Management
    // ===================

    function tbcBcUpdateChapterCount() {
        const count = $('.tbc-bc-chapter-item').length;
        $('#tbc-bc-chapter-count').text(count);
        
        // Update chapter index numbers
        $('.tbc-bc-chapter-item').each(function(index) {
            let $index = $(this).find('.tbc-bc-chapter-index');
            if ($index.length === 0) {
                $(this).find('.tbc-bc-chapter-handle').after('<span class="tbc-bc-chapter-index"></span>');
                $index = $(this).find('.tbc-bc-chapter-index');
            }
            $index.text(index + 1);
        });
        
        if (count > 0) {
            $('#tbc-bc-schedule-no-chapters').hide();
            $('#tbc-bc-schedule-content').show();
        } else {
            $('#tbc-bc-schedule-no-chapters').show();
            $('#tbc-bc-schedule-content').hide();
        }
        
        tbcBcUpdateMeetingChapters();
    }

    function tbcBcUpdateScheduleCount() {
        const count = $('.tbc-bc-schedule-item').length;
        $('#tbc-bc-schedule-count').text(count);
    }

    function tbcBcUpdateMeetingChapters() {
        const isAuto = $('#tbc-bc-schedule-auto').is(':checked');
        const totalChapters = $('.tbc-bc-chapter-item').length;
        const meetings = $('.tbc-bc-schedule-item');
        const totalMeetings = meetings.length;
        
        $('.tbc-bc-chapter-range').prop('readonly', isAuto);
        
        if (!isAuto) {
            tbcBcValidateAllRanges();
            return;
        }
        
        if (totalChapters === 0 || totalMeetings === 0) {
            $('.tbc-bc-chapter-range').val('');
            return;
        }
        
        const baseChaptersPerMeeting = Math.floor(totalChapters / totalMeetings);
        const extraChapters = totalChapters % totalMeetings;
        
        let currentChapter = 1;
        
        meetings.each(function(index) {
            const chaptersInThisMeeting = baseChaptersPerMeeting + (index < extraChapters ? 1 : 0);
            const endChapter = currentChapter + chaptersInThisMeeting - 1;
            
            const displayText = currentChapter === endChapter 
                ? currentChapter.toString() 
                : `${currentChapter}-${endChapter}`;
            
            $(this).find('.tbc-bc-chapter-range').val(displayText);
            currentChapter = endChapter + 1;
        });

        tbcBcClearValidation();
    }

    function tbcBcValidateAllRanges() {
        const totalChapters = $('.tbc-bc-chapter-item').length;
        const $validation = $('#tbc-bc-schedule-validation');
        let errors = [];
        
        $('.tbc-bc-schedule-item').each(function(index) {
            const $input = $(this).find('.tbc-bc-chapter-range');
            const rangeStr = $input.val().trim();
            
            if (!rangeStr) {
                $input.removeClass('tbc-bc-input-error');
                return;
            }
            
            const result = tbcBcValidateChapterRange(rangeStr, totalChapters);
            if (!result.valid) {
                $input.addClass('tbc-bc-input-error');
                errors.push(`Meeting ${index + 1}: ${result.error}`);
            } else {
                $input.removeClass('tbc-bc-input-error');
            }
        });
        
        if (errors.length > 0) {
            $validation.html('<span class="dashicons dashicons-warning"></span> ' + errors.join(' | ')).show();
        } else {
            $validation.empty().hide();
        }
    }

    function tbcBcClearValidation() {
        $('.tbc-bc-chapter-range').removeClass('tbc-bc-input-error');
        $('#tbc-bc-schedule-validation').empty().hide();
    }

    function tbcBcScheduleChapterUpdate() {
        setTimeout(function() {
            tbcBcUpdateMeetingChapters();
            tbcBcUpdateChapterCount();
            tbcBcUpdateScheduleCount();
        }, 10);
    }

    // ===================
    // Sortable Lists
    // ===================

    if ($('#tbc-bc-book-list').length) {
        $('#tbc-bc-book-list').sortable({
            handle: '.tbc-bc-book-handle',
            update: function() {
                const order = $(this).sortable('toArray', { attribute: 'data-id' });
                tbcBcUpdateBookOrder(order);
            }
        });
    }

    if ($('#tbc-bc-chapters-container').length) {
        $('#tbc-bc-chapters-container').sortable({
            handle: '.tbc-bc-chapter-handle',
            items: '.tbc-bc-chapter-item',
            update: tbcBcScheduleChapterUpdate
        });
    }

    if ($('#tbc-bc-schedule-container').length) {
        $('#tbc-bc-schedule-container').sortable({
            handle: '.tbc-bc-schedule-handle',
            items: '.tbc-bc-schedule-item',
            update: tbcBcScheduleChapterUpdate
        });
    }

    // ===================
    // Schedule Auto Toggle
    // ===================

    $('#tbc-bc-schedule-auto').on('change', function() {
        tbcBcUpdateMeetingChapters();
    });

    $(document).on('input', '.tbc-bc-chapter-range', function() {
        if (!$('#tbc-bc-schedule-auto').is(':checked')) {
            tbcBcValidateAllRanges();
        }
    });

    // ===================
    // Media Uploader
    // ===================

    let mediaUploader;
    
    $(document).on('click', '.tbc-bc-upload-cover', function(e) {
        e.preventDefault();
        
        if (mediaUploader) {
            mediaUploader.open();
            return;
        }
        
        mediaUploader = wp.media({
            title: 'Choose Book Cover',
            button: { text: 'Use this image' },
            multiple: false
        });
        
        mediaUploader.on('select', function() {
            const attachment = mediaUploader.state().get('selection').first().toJSON();
            $('#tbc_bc_cover_image').val(attachment.url);
            $('.tbc-bc-cover-preview').html('<img src="' + attachment.url + '" alt="Cover preview">');
        });
        
        mediaUploader.open();
    });

    // ===================
    // Chapter Add/Remove
    // ===================

    $('#tbc-bc-add-chapter').on('click', function() {
        const template = $('#tbc-bc-chapter-template').html();
        $('#tbc-bc-chapters-container').append(template);
        tbcBcScheduleChapterUpdate();
    });

    $(document).on('click', '.tbc-bc-remove-chapter', function() {
        $(this).closest('.tbc-bc-chapter-item').remove();
        tbcBcScheduleChapterUpdate();
    });

    // ===================
    // Schedule Add/Remove
    // ===================

    $('#tbc-bc-add-schedule').on('click', function() {
        const template = $('#tbc-bc-schedule-template').html();
        const $newItem = $(template);
        
        if ($('#tbc-bc-schedule-auto').is(':checked')) {
            $newItem.find('.tbc-bc-chapter-range').prop('readonly', true);
        }
        
        $('#tbc-bc-schedule-container').append($newItem);
        tbcBcScheduleChapterUpdate();
    });

    $(document).on('click', '.tbc-bc-remove-schedule', function() {
        $(this).closest('.tbc-bc-schedule-item').remove();
        tbcBcScheduleChapterUpdate();
    });

    // ===================
    // Time Input Formatting
    // ===================

    $(document).on('input', '.tbc-bc-chapter-time', function() {
        let value = $(this).val().replace(/[^0-9:]/g, '');
        if (value.length > 8) value = value.substr(0, 8);
        if (value.length === 2 && !value.includes(':')) value += ':';
        else if (value.length === 5 && value.indexOf(':') === value.lastIndexOf(':')) value += ':';
        $(this).val(value);
    });

    // ===================
    // Moderator Search
    // ===================

    let searchTimeout;
    
    $('#tbc-bc-moderator-search').on('input', function() {
        const search = $(this).val().trim();
        const $results = $('#tbc-bc-user-results');
        
        clearTimeout(searchTimeout);
        
        if (search.length < 2) {
            $results.empty().hide();
            return;
        }
        
        searchTimeout = setTimeout(function() {
            $.get(tbcBcAdmin.ajaxurl, {
                action: 'tbc_bc_search_users',
                nonce: tbcBcAdmin.nonce,
                search: search
            })
            .done(function(response) {
                if (response.success && response.data.length > 0) {
                    let html = '';
                    response.data.forEach(function(user) {
                        html += '<div class="tbc-bc-user-result" data-id="' + user.id + '" data-name="' + tbcBcEscapeHtml(user.name) + '">' +
                            '<span class="tbc-bc-user-name">' + tbcBcEscapeHtml(user.name) + '</span>' +
                            '<span class="tbc-bc-user-email">' + tbcBcEscapeHtml(user.email) + '</span>' +
                        '</div>';
                    });
                    $results.html(html).show();
                } else {
                    $results.html('<div class="tbc-bc-no-results">No users found</div>').show();
                }
            });
        }, 300);
    });

    $(document).on('click', '.tbc-bc-user-result', function() {
        const userId = $(this).data('id');
        const userName = $(this).data('name');
        
        $('#tbc-bc-moderator-id').val(userId);
        $('#tbc-bc-moderator-name').text(userName);
        $('#tbc-bc-moderator-display').removeClass('tbc-bc-hidden');
        $('#tbc-bc-moderator-search').val('');
        $('#tbc-bc-user-results').empty().hide();
    });

    $('#tbc-bc-clear-moderator').on('click', function() {
        $('#tbc-bc-moderator-id').val('');
        $('#tbc-bc-moderator-name').text('');
        $('#tbc-bc-moderator-display').addClass('tbc-bc-hidden');
    });

    $(document).on('click', function(e) {
        if (!$(e.target).closest('.tbc-bc-moderator-search').length) {
            $('#tbc-bc-user-results').empty().hide();
        }
    });

    // ===================
    // Award Points
    // ===================

    $('#tbc-bc-award-points').on('click', function() {
        const $btn = $(this);
        const bookId = $btn.data('book-id');
        
        if (!confirm('Award 100 Rose Quartz to the moderator for this book?')) {
            return;
        }
        
        $btn.prop('disabled', true).text('Awarding...');
        
        $.post(tbcBcAdmin.ajaxurl, {
            action: 'tbc_bc_award_moderator',
            nonce: tbcBcAdmin.nonce,
            book_id: bookId
        })
        .done(function(response) {
            if (response.success) {
                $btn.closest('.tbc-bc-award-section').html(
                    '<div class="tbc-bc-award-complete">' +
                        '<span class="dashicons dashicons-yes-alt"></span>' +
                        '<span>' + response.data.message + '</span>' +
                    '</div>'
                );
                tbcBcShowMessage(response.data.message, 'success');
            } else {
                tbcBcShowMessage(response.data || 'Error awarding points', 'error');
                $btn.prop('disabled', false).html('<span class="dashicons dashicons-awards"></span> Award Moderator Achievement');
            }
        })
        .fail(function() {
            tbcBcShowMessage('Error awarding points', 'error');
            $btn.prop('disabled', false).html('<span class="dashicons dashicons-awards"></span> Award 100 Rose Quartz');
        });
    });

    // ===================
    // MediaInfo Import
    // ===================

    $('.tbc-bc-import-toggle').on('click', function() {
        const $container = $('.tbc-bc-import-container');
        const isVisible = $container.is(':visible');
        
        if (isVisible) {
            $container.slideUp(300);
            $(this).find('.dashicons').removeClass('dashicons-arrow-up').addClass('dashicons-upload');
        } else {
            $container.slideDown(300);
            $(this).find('.dashicons').removeClass('dashicons-upload').addClass('dashicons-arrow-up');
            $('#tbc-bc-mediainfo-input').focus();
        }
    });

    $('.tbc-bc-import-cancel').on('click', function() {
        $('#tbc-bc-mediainfo-input').val('');
        $('.tbc-bc-import-message').html('');
        $('.tbc-bc-import-container').slideUp(300);
        $('.tbc-bc-import-toggle').find('.dashicons').removeClass('dashicons-arrow-up').addClass('dashicons-upload');
    });

    $('.tbc-bc-parse-json').on('click', function() {
        const jsonInput = $('#tbc-bc-mediainfo-input').val().trim();
        const $message = $('.tbc-bc-import-message');
        
        $message.html('');
        
        if (!jsonInput) {
            tbcBcShowImportMessage('Please paste MediaInfo JSON data.', 'error');
            return;
        }

        try {
            const data = JSON.parse(jsonInput);
            const chapters = tbcBcParseMediaInfo(data);
            
            if (chapters.length === 0) {
                tbcBcShowImportMessage('No chapters found in MediaInfo JSON.', 'error');
                return;
            }

            $('#tbc-bc-chapters-container').empty();
            
            chapters.forEach(function(chapter) {
                const $newChapter = $(tbcBcCreateChapterHTML(chapter.label, chapter.title, chapter.time));
                $('#tbc-bc-chapters-container').append($newChapter);
            });

            tbcBcShowImportMessage('Successfully imported ' + chapters.length + ' chapters!', 'success');
            tbcBcScheduleChapterUpdate();
            
            setTimeout(function() {
                $('.tbc-bc-import-cancel').click();
            }, 2000);

        } catch (error) {
            tbcBcShowImportMessage('Invalid JSON format.', 'error');
        }
    });

    function tbcBcParseMediaInfo(data) {
        const chapters = [];
        
        if (!data.media || !data.media.track || !Array.isArray(data.media.track)) {
            throw new Error('Invalid MediaInfo structure');
        }

        const menuTrack = data.media.track.find(function(track) {
            return track['@type'] === 'Menu';
        });
        
        if (!menuTrack || !menuTrack.extra) {
            throw new Error('No Menu track found');
        }

        const extra = menuTrack.extra;
        
        for (const [key, value] of Object.entries(extra)) {
            if (key.startsWith('_') && key.match(/_\d{2}_\d{2}_\d{2}_\d{3}/)) {
                const timestamp = tbcBcConvertTimestamp(key);
                
                if (timestamp) {
                    chapters.push({
                        label: value,
                        title: value,
                        time: timestamp
                    });
                }
            }
        }

        chapters.sort(function(a, b) {
            const [aH, aM, aS] = a.time.split(':').map(Number);
            const [bH, bM, bS] = b.time.split(':').map(Number);
            return (aH * 3600 + aM * 60 + aS) - (bH * 3600 + bM * 60 + bS);
        });

        return chapters;
    }

    function tbcBcConvertTimestamp(key) {
        const match = key.match(/_(\d{2})_(\d{2})_(\d{2})_(\d{3})/);
        if (!match) return null;
        return match[1] + ':' + match[2] + ':' + match[3];
    }

    function tbcBcCreateChapterHTML(label, title, time) {
        return '<div class="tbc-bc-chapter-item">' +
            '<div class="tbc-bc-chapter-handle">' +
                '<span class="tbc-bc-chapter-index"></span>' +
                '<span class="dashicons dashicons-menu"></span>' +
            '</div>' +
            '<div class="tbc-bc-chapter-fields">' +
                '<input type="text" name="chapter_labels[]" value="' + tbcBcEscapeHtml(label) + '" placeholder="Chapter label" class="tbc-bc-chapter-label" required>' +
                '<input type="text" name="chapter_titles[]" value="' + tbcBcEscapeHtml(title) + '" placeholder="Chapter title" required>' +
                '<input type="text" name="chapter_times[]" value="' + tbcBcEscapeHtml(time) + '" placeholder="Time (HH:MM:SS)" pattern="^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$" required class="tbc-bc-chapter-time">' +
                '<button type="button" class="button tbc-bc-remove-chapter"><span class="dashicons dashicons-trash"></span></button>' +
            '</div>' +
        '</div>';
    }

    function tbcBcShowImportMessage(message, type) {
        const $message = $('.tbc-bc-import-message');
        $message.html('<div class="tbc-bc-import-' + type + '">' + message + '</div>');
        if (type === 'success') {
            setTimeout(function() {
                $message.html('');
            }, 3000);
        }
    }

    // ===================
    // Form Submission
    // ===================

    $('#tbc-bc-edit-form').on('submit', function(e) {
        e.preventDefault();
        
        if (!tbcBcValidateForm()) return;
        
        const form = $(this);
        form.addClass('tbc-bc-loading');
        
        const chapters = [];
        $('.tbc-bc-chapter-item').each(function() {
            const $item = $(this);
            const label = $item.find('input[name="chapter_labels[]"]').val().trim();
            const title = $item.find('input[name="chapter_titles[]"]').val().trim();
            const timeStr = $item.find('input[name="chapter_times[]"]').val();
            
            if (timeStr && tbcBcValidateTimeFormat(timeStr)) {
                const parts = timeStr.split(':').map(Number);
                const totalSeconds = (parts[0] * 3600) + (parts[1] * 60) + parts[2];
                chapters.push({ label: label, title: title, time: totalSeconds });
            }
        });

        chapters.sort(function(a, b) {
            return a.time - b.time;
        });

        const isAuto = $('#tbc-bc-schedule-auto').is(':checked');
        const schedule = [];
        $('.tbc-bc-schedule-item').each(function() {
            const $item = $(this);
            const date = $item.find('input[name="meeting_dates[]"]').val();
            const time = $item.find('input[name="meeting_times[]"]').val();
            const chaptersText = $item.find('input[name="meeting_chapters[]"]').val().trim();
            
            if (date && time) {
                schedule.push({ 
                    date: date, 
                    time: time, 
                    chapters: chaptersText,
                    auto: isAuto
                });
            }
        });

        const formData = {
            action: 'tbc_bc_save_book',
            nonce: tbcBcAdmin.nonce,
            book_id: $('input[name="book_id"]').val(),
            title: $('#tbc_bc_title').val(),
            author: $('#tbc_bc_author').val(),
            description: tinyMCE.get('tbc_bc_description') ? tinyMCE.get('tbc_bc_description').getContent() : $('#tbc_bc_description').val(),
            cover_image: $('#tbc_bc_cover_image').val(),
            single_audio_url: $('#tbc_bc_audio').val(),
            chapters: JSON.stringify(chapters),
            schedule_data: JSON.stringify(schedule),
            meeting_link: $('#tbc_bc_meeting_link').val(),
            meeting_id: $('#tbc_bc_meeting_id').val(),
            meeting_passcode: $('#tbc_bc_meeting_passcode').val(),
            moderator_user_id: $('#tbc-bc-moderator-id').val()
        };

        $.post(tbcBcAdmin.ajaxurl, formData)
            .done(function(response) {
                if (response.success) {
                    tbcBcShowMessage('Book saved successfully!', 'success');
                    setTimeout(function() {
                        window.location.href = '?page=tbc-bc-manager';
                    }, 1000);
                } else {
                    tbcBcShowMessage(response.data || 'Error saving book.', 'error');
                }
            })
            .fail(function() {
                tbcBcShowMessage('Error saving book.', 'error');
            })
            .always(function() {
                form.removeClass('tbc-bc-loading');
            });
    });

    // ===================
    // Delete Book
    // ===================

    $('.tbc-bc-delete-book').on('click', function() {
        if (!confirm('Are you sure you want to delete this book?')) return;

        const button = $(this);
        const bookId = button.data('id');
        
        button.prop('disabled', true);
        
        $.post(tbcBcAdmin.ajaxurl, {
            action: 'tbc_bc_delete_book',
            nonce: tbcBcAdmin.nonce,
            book_id: bookId
        })
        .done(function(response) {
            if (response.success) {
                button.closest('.tbc-bc-book-item').fadeOut(function() {
                    $(this).remove();
                });
            } else {
                tbcBcShowMessage('Error deleting book.', 'error');
                button.prop('disabled', false);
            }
        })
        .fail(function() {
            tbcBcShowMessage('Error deleting book.', 'error');
            button.prop('disabled', false);
        });
    });

    // ===================
    // Set Current Book
    // ===================

    $('.tbc-bc-set-current').on('click', function() {
        const button = $(this);
        const bookId = button.data('id');
        const isCurrent = !button.closest('.tbc-bc-book-item').find('.tbc-bc-current-badge').length;
        
        button.prop('disabled', true);
        
        $.post(tbcBcAdmin.ajaxurl, {
            action: 'tbc_bc_set_current_book',
            nonce: tbcBcAdmin.nonce,
            book_id: bookId,
            is_current: isCurrent ? 1 : 0
        })
        .done(function(response) {
            if (response.success) {
                location.reload();
            } else {
                tbcBcShowMessage('Error updating current book.', 'error');
                button.prop('disabled', false);
            }
        })
        .fail(function() {
            tbcBcShowMessage('Error updating current book.', 'error');
            button.prop('disabled', false);
        });
    });

    // ===================
    // Helper Functions
    // ===================

    function tbcBcUpdateBookOrder(order) {
        $.post(tbcBcAdmin.ajaxurl, {
            action: 'tbc_bc_reorder_books',
            nonce: tbcBcAdmin.nonce,
            order: JSON.stringify(order)
        }).fail(function() {
            tbcBcShowMessage('Error updating book order.', 'error');
        });
    }

    function tbcBcShowMessage(message, type) {
        type = type || 'success';
        const messageHtml = '<div class="notice notice-' + type + ' is-dismissible"><p>' + message + '</p></div>';
        $('.wrap > h1').after(messageHtml);
        setTimeout(function() {
            $('.notice').fadeOut(function() {
                $(this).remove();
            });
        }, 3000);
    }

    function tbcBcValidateForm() {
        let isValid = true;
        
        $('.tbc-bc-form-field, .tbc-bc-chapter-fields, .tbc-bc-schedule-fields').removeClass('tbc-bc-has-error');
        $('.tbc-bc-error-message').remove();
        
        $('#tbc-bc-edit-form input[required]').each(function() {
            if (!$(this).val()) {
                $(this).closest('.tbc-bc-form-field, .tbc-bc-chapter-fields, .tbc-bc-schedule-fields')
                       .addClass('tbc-bc-has-error')
                       .append('<span class="tbc-bc-error-message">This field is required</span>');
                isValid = false;
            }
        });
        
        $('#tbc-bc-edit-form input[type="url"]').each(function() {
            if ($(this).val() && !tbcBcIsValidUrl($(this).val())) {
                $(this).closest('.tbc-bc-form-field')
                       .addClass('tbc-bc-has-error')
                       .append('<span class="tbc-bc-error-message">Please enter a valid URL</span>');
                isValid = false;
            }
        });

        $('.tbc-bc-chapter-time').each(function() {
            if ($(this).val() && !tbcBcValidateTimeFormat($(this).val())) {
                $(this).closest('.tbc-bc-chapter-fields')
                       .addClass('tbc-bc-has-error')
                       .append('<span class="tbc-bc-error-message">Use HH:MM:SS format</span>');
                isValid = false;
            }
        });

        if (!$('#tbc-bc-schedule-auto').is(':checked')) {
            const totalChapters = $('.tbc-bc-chapter-item').length;
            $('.tbc-bc-chapter-range').each(function() {
                const val = $(this).val().trim();
                if (val) {
                    const result = tbcBcValidateChapterRange(val, totalChapters);
                    if (!result.valid) {
                        isValid = false;
                    }
                }
            });
        }
        
        return isValid;
    }

    function tbcBcIsValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (e) {
            return false;
        }
    }

    // ===================
    // Initialize
    // ===================

    tbcBcUpdateMeetingChapters();
    tbcBcUpdateChapterCount();
    tbcBcUpdateScheduleCount();
});