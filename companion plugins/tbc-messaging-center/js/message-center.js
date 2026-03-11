/**
 * Message Center - Chat UI JavaScript
 * Handles two-panel navigation, search, bulk operations, and reply panel
 */

jQuery(document).ready(function($) {

    // ========================================================================
    // STATE
    // ========================================================================

    let currentFilter = 'all';
    let currentPhone = null;
    let searchTimeout = null;
    let searchDirection = 'all';

    // ========================================================================
    // TAB NAVIGATION - Switch between Inbox, Send SMS, Scheduled, Call
    // ========================================================================

    $(document).on('click', '.tbc-mc-tab', function() {
        const tab = $(this).data('tab');
        const content = $(`.tbc-mc-tab-content[data-content="${tab}"]`);

        // Don't reload if already active
        if ($(this).hasClass('active')) return;

        // Load content if not already loaded (inbox is pre-loaded)
        if (!content.data('loaded') && tab !== 'inbox') {
            content.html('<div class="tbc-mc-loading">Loading...</div>');

            window.tbcMcAjax('tbc_mc_load_tab_content', { tab: tab })
                .done(function(response) {
                    if (response.success) {
                        content.html(response.data.html).data('loaded', true);

                        // Initialize any tab-specific functionality after load
                        initializeTabContent(tab);
                    } else {
                        content.html('<div class="tbc-mc-empty-state"><p>Error loading content</p></div>');
                    }
                })
                .fail(function() {
                    content.html('<div class="tbc-mc-empty-state"><p>Error loading content</p></div>');
                });
        }

        // Switch tabs
        $('.tbc-mc-tab').removeClass('active');
        $(this).addClass('active');
        $('.tbc-mc-tab-content').addClass('hidden');
        content.removeClass('hidden');
    });

    /**
     * Initialize tab-specific functionality after content loads
     */
    function initializeTabContent(tab) {
        if (tab === 'send') {
            // Trigger character counter update if textarea exists
            if (window.CharCounter) {
                $('textarea[name="sms_message"]').trigger('keyup');
            }
        } else if (tab === 'scheduled') {
            // Scheduler tab - functionality handled by scheduler.js
        } else if (tab === 'call') {
            // Initialize autocomplete after tab content loads
            initCallAutocomplete();
        } else if (tab === 'settings') {
            initSettingsTab();
        }
    }

    /**
     * Initialize Settings tab save functionality
     */
    function initSettingsTab() {
        $(document).off('click', '#tbc-mc-save-settings').on('click', '#tbc-mc-save-settings', function() {
            const $btn = $(this);
            const $feedback = $('#tbc-mc-settings-feedback');

            $btn.prop('disabled', true).text('Saving...');
            $feedback.text('');

            window.tbcMcAjax('tbc_mc_save_settings', {
                twilio_sid: $('#tbc-mc-twilio-sid').val(),
                twilio_token: $('#tbc-mc-twilio-token').val(),
                twilio_messaging_sid: $('#tbc-mc-twilio-messaging-sid').val(),
                twilio_number: $('#tbc-mc-twilio-number').val()
            })
            .done(function(response) {
                if (response.success) {
                    $feedback.text('Settings saved!').css('color', '#22c55e');
                } else {
                    $feedback.text(response.data?.message || 'Error saving settings.').css('color', '#ef4444');
                }
            })
            .fail(function() {
                $feedback.text('Error saving settings.').css('color', '#ef4444');
            })
            .always(function() {
                $btn.prop('disabled', false).text('Save Settings');
            });
        });
    }

    /**
     * Initialize Call tab user search autocomplete
     * Must be called after tab content is loaded
     */
    function initCallAutocomplete() {
        const searchInput = $('#tbc-mc-user-search');
        if (!searchInput.length) return;

        // Don't re-init if already initialized
        if (searchInput.hasClass('ui-autocomplete-input')) return;

        // Check jQuery UI autocomplete is available
        if (!$.ui || !$.ui.autocomplete) {
            console.warn('jQuery UI Autocomplete not available');
            return;
        }

        let timeout;

        searchInput.autocomplete({
            source: function(request, response) {
                clearTimeout(timeout);
                response([{ label: 'Searching...', value: '' }]);

                timeout = setTimeout(function() {
                    $.ajax({
                        url: tbcMC.ajaxurl,
                        dataType: 'json',
                        method: 'POST',
                        data: {
                            term: request.term,
                            action: 'tbc_mc_search_users',
                            nonce: tbcMC.nonce
                        },
                        success: function(data) {
                            if (!data || data.length === 0) {
                                response([{ label: 'No results', value: '' }]);
                            } else {
                                response(data);
                            }
                        },
                        error: function() {
                            response([{ label: 'Error occurred', value: '' }]);
                        }
                    });
                }, 300);
            },
            select: function(event, ui) {
                if (ui.item.value === '') {
                    event.preventDefault();
                    return;
                }
                $('#tbc-mc-call-button').prop('disabled', false).data('user-id', ui.item.id);
            },
            minLength: 1
        });
    }

    // ========================================================================
    // CONVERSATION LIST - Click to open thread
    // ========================================================================

    $(document).on('click', '.tbc-mc-conversation-item', function(e) {
        // Don't trigger if clicking checkbox
        if ($(e.target).hasClass('tbc-mc-select')) return;

        const item = $(this);
        const phone = item.data('phone');

        // Set active state
        $('.tbc-mc-conversation-item').removeClass('active');
        item.addClass('active');

        // Load thread
        loadThread(phone);
    });

    function loadThread(phone) {
        currentPhone = phone;
        const threadPanel = $('.tbc-mc-thread-panel');

        threadPanel.removeClass('empty').html('<div class="tbc-mc-loading">Loading messages...</div>');

        // On mobile, show the thread panel
        if (window.innerWidth <= tbcMC.mobileBreakpoint) {
            threadPanel.addClass('active');
        }

        tbcMcAjax('tbc_mc_get_thread', { phone: phone })
        .done(function(response) {
            if (response.success) {
                threadPanel.html(response.data.html);

                // Scroll to bottom of messages
                const messagesContainer = threadPanel.find('.tbc-mc-messages');
                messagesContainer.scrollTop(messagesContainer[0].scrollHeight);

                // Update conversation item (remove unread)
                $(`.tbc-mc-conversation-item[data-phone="${phone}"]`)
                    .removeClass('unread')
                    .find('.tbc-mc-unread-dot').remove();

                // Update filter counts
                updateFilterCounts();
            } else {
                threadPanel.html('<div class="tbc-mc-empty-state"><p>Error loading messages</p></div>');
            }
        })
        .fail(function() {
            threadPanel.html('<div class="tbc-mc-empty-state"><p>Error loading messages</p></div>');
        });
    }

    // ========================================================================
    // BACK BUTTON (Mobile)
    // ========================================================================

    $(document).on('click', '.tbc-mc-back-btn', function() {
        $('.tbc-mc-thread-panel').removeClass('active');
        currentPhone = null;
    });

    // ========================================================================
    // FILTER BUTTONS
    // ========================================================================

    $(document).on('click', '.tbc-mc-filter-btn', function() {
        const btn = $(this);
        const filter = btn.data('filter');

        if (filter === currentFilter) return;

        currentFilter = filter;

        // Update active state
        $('.tbc-mc-filter-btn').removeClass('active');
        btn.addClass('active');

        // Update mark all read button
        $('.tbc-mc-mark-all-read').data('filter', filter);

        // Load filtered conversations
        loadConversations(filter);
    });

    function loadConversations(filter) {
        const container = $('.tbc-mc-conversations');
        container.html('<div class="tbc-mc-loading">Loading...</div>');

        tbcMcAjax('tbc_mc_get_conversations', { filter: filter })
        .done(function(response) {
            if (response.success) {
                container.html(response.data.html);

                // Update counts
                if (response.data.counts) {
                    updateFilterCountsFromData(response.data.counts);
                }
            } else {
                container.html('<div class="tbc-mc-empty-state"><p>Error loading conversations</p></div>');
            }
        })
        .fail(function() {
            container.html('<div class="tbc-mc-empty-state"><p>Error loading conversations</p></div>');
        });
    }

    function updateFilterCounts() {
        tbcMcAjax('tbc_mc_get_conversations', { filter: 'all' })
        .done(function(response) {
            if (response.success && response.data.counts) {
                updateFilterCountsFromData(response.data.counts);
            }
        });
    }

    function updateFilterCountsFromData(counts) {
        $('.tbc-mc-filter-btn[data-filter="all"] .tbc-mc-filter-count').text('(' + counts.total + ')');
        $('.tbc-mc-filter-btn[data-filter="unread"] .tbc-mc-filter-count').text('(' + counts.unread + ')');
        $('.tbc-mc-filter-btn[data-filter="starred"] .tbc-mc-filter-count').text('(' + counts.starred + ')');
    }

    // ========================================================================
    // SEARCH
    // ========================================================================

    $(document).on('input', '.tbc-mc-search', function() {
        const query = $(this).val().trim();

        clearTimeout(searchTimeout);

        if (query.length < 2) {
            // Reset to normal view
            if (query.length === 0) {
                loadConversations(currentFilter);
            }
            return;
        }

        searchTimeout = setTimeout(function() {
            searchMessages(query);
        }, 300);
    });

    function searchMessages(query) {
        const container = $('.tbc-mc-conversations');
        container.html('<div class="tbc-mc-loading">Searching...</div>');

        tbcMcAjax('tbc_mc_search', {
            query: query,
            filter: currentFilter,
            direction: searchDirection
        })
        .done(function(response) {
            if (response.success) {
                container.html(response.data.html);
            } else {
                container.html('<div class="tbc-mc-empty-state"><p>No results found</p></div>');
            }
        })
        .fail(function() {
            container.html('<div class="tbc-mc-empty-state"><p>Search error</p></div>');
        });
    }

    // ========================================================================
    // SEARCH FILTER DROPDOWN
    // ========================================================================

    $(document).on('click', '.tbc-mc-search-filter-btn', function(e) {
        e.stopPropagation();
        $(this).closest('.tbc-mc-search-filter').toggleClass('open');
    });

    $(document).on('click', '.tbc-mc-search-filter-option', function() {
        const option = $(this);
        const direction = option.data('direction');
        const label = direction === 'all' ? 'All' : direction === 'received' ? 'Received' : 'Sent';

        // Update state
        searchDirection = direction;

        // Update UI
        $('.tbc-mc-search-filter-option').removeClass('active');
        option.addClass('active');
        $('.tbc-mc-search-filter-btn').text(label + ' ▼');

        // Close dropdown
        $('.tbc-mc-search-filter').removeClass('open');

        // Re-run search if there's a query
        const query = $('.tbc-mc-search').val().trim();
        if (query.length >= 2) {
            searchMessages(query);
        }
    });

    // Close dropdown when clicking elsewhere
    $(document).on('click', function(e) {
        if (!$(e.target).closest('.tbc-mc-search-filter').length) {
            $('.tbc-mc-search-filter').removeClass('open');
        }
    });

    // ========================================================================
    // BULK SELECTION
    // ========================================================================

    $(document).on('change', '.tbc-mc-select', function(e) {
        e.stopPropagation();
        updateBulkButtons();
    });

    function updateBulkButtons() {
        const selectedCount = $('.tbc-mc-select:checked').length;
        const hasSelection = selectedCount > 0;

        $('.tbc-mc-bulk-delete, .tbc-mc-bulk-star').prop('disabled', !hasSelection);
    }

    function getSelectedPhones() {
        const phones = [];
        $('.tbc-mc-select:checked').each(function() {
            const phone = $(this).closest('.tbc-mc-conversation-item').data('phone');
            if (phone) phones.push(phone);
        });
        return phones;
    }

    // ========================================================================
    // MARK ALL READ
    // ========================================================================

    $(document).on('click', '.tbc-mc-mark-all-read', function() {
        const btn = $(this);
        const filter = btn.data('filter') || 'all';

        if (!confirm('Mark all messages as read?')) return;

        btn.prop('disabled', true);

        tbcMcAjax('tbc_mc_mark_all_read', { filter: filter })
        .done(function(response) {
            if (response.success) {
                // Remove unread styling from all visible items
                $('.tbc-mc-conversation-item').removeClass('unread');
                $('.tbc-mc-unread-dot').remove();

                // Update counts
                updateFilterCounts();

                showToast('success', 'All messages marked as read');
            } else {
                showToast('error', 'Error marking messages as read');
            }
        })
        .fail(function() {
            showToast('error', 'Error marking messages as read');
        })
        .always(function() {
            btn.prop('disabled', false);
        });
    });

    // ========================================================================
    // BULK DELETE
    // ========================================================================

    $(document).on('click', '.tbc-mc-bulk-delete', function() {
        const phones = getSelectedPhones();
        if (phones.length === 0) return;

        if (!confirm(`Delete ${phones.length} conversation(s)? This cannot be undone.`)) return;

        const btn = $(this);
        btn.prop('disabled', true);

        tbcMcAjax('tbc_mc_bulk_action', {
            bulk_action: 'delete',
            phones: phones
        })
        .done(function(response) {
            if (response.success) {
                // Remove deleted conversations from list
                phones.forEach(function(phone) {
                    $(`.tbc-mc-conversation-item[data-phone="${phone}"]`).remove();
                });

                // Clear thread if current conversation was deleted
                if (currentPhone && phones.includes(currentPhone)) {
                    $('.tbc-mc-thread-panel').addClass('empty').html(
                        '<div class="tbc-mc-empty-state"><span class="bb-icon bb-icon-comment-activity"></span><p>Select a conversation to view messages</p></div>'
                    );
                    currentPhone = null;
                }

                updateFilterCounts();
                showToast('success', `${phones.length} conversation(s) deleted`);
            } else {
                showToast('error', 'Error deleting conversations');
            }
        })
        .fail(function() {
            showToast('error', 'Error deleting conversations');
        })
        .always(function() {
            btn.prop('disabled', false);
            updateBulkButtons();
        });
    });

    // ========================================================================
    // BULK STAR
    // ========================================================================

    $(document).on('click', '.tbc-mc-bulk-star', function() {
        const phones = getSelectedPhones();
        if (phones.length === 0) return;

        const btn = $(this);
        btn.prop('disabled', true);

        tbcMcAjax('tbc_mc_bulk_action', {
            bulk_action: 'star',
            phones: phones
        })
        .done(function(response) {
            if (response.success) {
                // Uncheck all
                $('.tbc-mc-select').prop('checked', false);
                // Reload conversations to show star indicators
                loadConversations(currentFilter);
                // Reload thread if open to reflect changes
                if (currentPhone) {
                    loadThread(currentPhone);
                }
                showToast('success', response.data?.message || `${phones.length} conversation(s) updated`);
            } else {
                showToast('error', 'Error updating conversations');
            }
        })
        .fail(function() {
            showToast('error', 'Error starring conversations');
        })
        .always(function() {
            btn.prop('disabled', false);
            updateBulkButtons();
        });
    });

    // ========================================================================
    // REPLY PANEL (Slide-over)
    // ========================================================================

    $(document).on('click', '.tbc-mc-reply-btn', function() {
        const phone = $(this).data('phone');
        const name = $(this).data('name');

        openReplyPanel(phone, name);
    });

    function openReplyPanel(phone, name) {
        const panel = $('.tbc-mc-reply-panel');
        const content = panel.find('.tbc-mc-reply-panel-content');

        // Update title
        panel.find('.tbc-mc-reply-panel-title').text('Reply to ' + name);

        // Show loading
        content.html('<div class="tbc-mc-loading">Loading form...</div>');

        // Open panel
        panel.addClass('open');
        $('.tbc-mc-overlay').addClass('visible');

        // Load form
        tbcMcAjax('tbc_mc_get_reply_form', { phone: phone, name: name })
        .done(function(response) {
            if (response.success) {
                content.html(response.data.html);
            } else {
                content.html('<p>Error loading form</p>');
            }
        })
        .fail(function() {
            content.html('<p>Error loading form</p>');
        });
    }

    function closeReplyPanel() {
        $('.tbc-mc-reply-panel').removeClass('open');
        $('.tbc-mc-overlay').removeClass('visible');
    }

    $(document).on('click', '.tbc-mc-close-reply', closeReplyPanel);
    $(document).on('click', '.tbc-mc-overlay', closeReplyPanel);

    // Handle form submission in reply panel
    $(document).on('submit', '.tbc-mc-reply-panel-content form', function(event) {
        event.preventDefault();

        const form = $(this);
        const senderNumber = form.find('input[name="sender_number"]').val();
        const recipientName = form.find('.tbc-mc-contact-name').text() || 'Friend';

        if (window.handleSMSFormSubmission) {
            const success = window.handleSMSFormSubmission(form, recipientName);

            // Only close panel if submission was accepted
            if (success) {
                setTimeout(function() {
                    closeReplyPanel();
                    // Reload thread if still viewing same conversation
                    if (currentPhone === senderNumber) {
                        loadThread(currentPhone);
                    }
                }, 2000);
            }
        }
    });

    // ========================================================================
    // CALL BUTTON
    // ========================================================================

    $(document).on('click', '.tbc-mc-call-btn', function() {
        const btn = $(this);
        const phone = btn.data('phone');

        btn.prop('disabled', true);

        tbcMcAjax('tbc_mc_callback', { caller_number: phone })
        .done(function(response) {
            if (response.success) {
                showToast('success', 'Call initiated');
            } else {
                showToast('error', response.data?.message || 'Error initiating call');
            }
        })
        .fail(function() {
            showToast('error', 'Error initiating call');
        })
        .always(function() {
            btn.prop('disabled', false);
        });
    });

    // ========================================================================
    // CHAT BUBBLE ACTIONS (Star, Delete)
    // ========================================================================

    $(document).on('click', '.tbc-mc-star-btn', function(e) {
        e.stopPropagation();
        const btn = $(this);
        const bubble = btn.closest('.tbc-mc-bubble');
        const messageId = bubble.data('message-id');

        tbcMcAjax('tbc_mc_toggle_marking', { message_id: messageId })
        .done(function(response) {
            if (response.success) {
                // Use response to set state (not toggle) - ensures sync with database
                const isNowStarred = response.data && response.data.marked == 1;
                btn.toggleClass('starred', isNowStarred);
                bubble.toggleClass('tbc-mc-starred', isNowStarred);
                // Update conversation list star indicator
                updateFilterCounts();
                showToast('success', isNowStarred ? 'Message starred' : 'Message unstarred');
            } else {
                showToast('error', 'Failed to update star');
            }
        })
        .fail(function() {
            showToast('error', 'Error connecting to server');
        });
    });

    $(document).on('click', '.tbc-mc-delete-btn', function(e) {
        e.stopPropagation();

        if (!confirm('Delete this message?')) return;

        const btn = $(this);
        const bubble = btn.closest('.tbc-mc-bubble');
        const messageId = bubble.data('message-id');

        tbcMcAjax('tbc_mc_delete_message', { message_id: messageId })
        .done(function(response) {
            if (response.success) {
                bubble.fadeOut(300, function() {
                    $(this).remove();
                });
                showToast('success', 'Message deleted');
                updateFilterCounts();
            } else {
                showToast('error', 'Failed to delete message');
            }
        })
        .fail(function() {
            showToast('error', 'Error connecting to server');
        });
    });

    // ========================================================================
    // NOTE BUTTON
    // ========================================================================

    $(document).on('click', '.tbc-mc-note-btn', function(e) {
        e.stopPropagation();

        const btn = $(this);
        const bubble = btn.closest('.tbc-mc-bubble');
        const messageId = bubble.data('message-id');

        // Get existing note if any
        const existingNoteEl = bubble.find('.tbc-mc-bubble-note-display');
        const existingNote = existingNoteEl.length ? existingNoteEl.text() : '';

        // Prompt for note
        const newNote = prompt('Add a note to this message:', existingNote);

        // User cancelled
        if (newNote === null) return;

        tbcMcAjax('tbc_mc_save_notes', {
            message_id: messageId,
            notes: newNote
        })
        .done(function(response) {
            if (response.success) {
                const savedNote = response.data.notes;

                // Update or create note display
                if (savedNote && savedNote.trim() !== '') {
                    btn.addClass('has-note');
                    if (existingNoteEl.length) {
                        existingNoteEl.text(savedNote);
                    } else {
                        bubble.append('<div class="tbc-mc-bubble-note-display">' + $('<div>').text(savedNote).html() + '</div>');
                    }
                    showToast('success', 'Note saved');
                } else {
                    // Note cleared
                    btn.removeClass('has-note');
                    existingNoteEl.remove();
                    showToast('success', 'Note removed');
                }
            } else {
                showToast('error', 'Failed to save note');
            }
        })
        .fail(function() {
            showToast('error', 'Error connecting to server');
        });
    });

    // ========================================================================
    // KEYBOARD SHORTCUTS
    // ========================================================================

    $(document).on('keydown', function(e) {
        // Escape key closes reply panel
        if (e.key === 'Escape') {
            if ($('.tbc-mc-reply-panel').hasClass('open')) {
                closeReplyPanel();
            }
            // Close scheduled detail panel on mobile
            if ($('.tbc-mc-scheduled-detail-panel').hasClass('active')) {
                $('.tbc-mc-scheduled-detail-panel').removeClass('active');
            }
        }
    });

    // ========================================================================
    // SCHEDULED TAB - Two Panel Navigation
    // ========================================================================

    let currentScheduledFilter = 'all';

    // Click on scheduled message item to load details
    $(document).on('click', '.tbc-mc-scheduled-item', function() {
        const item = $(this);
        const parentId = item.data('parent-id');

        // Set active state
        $('.tbc-mc-scheduled-item').removeClass('active');
        item.addClass('active');

        // Load details
        loadScheduledDetail(parentId);
    });

    function loadScheduledDetail(parentId) {
        const detailPanel = $('.tbc-mc-scheduled-detail-panel');

        detailPanel.removeClass('empty').html('<div class="tbc-mc-loading">Loading details...</div>');

        // On mobile, show the detail panel
        if (window.innerWidth <= tbcMC.mobileBreakpoint) {
            detailPanel.addClass('active');
        }

        tbcMcAjax('tbc_mc_get_scheduled_detail', { parent_id: parentId })
        .done(function(response) {
            if (response.success) {
                detailPanel.html(response.data.html);
            } else {
                detailPanel.html('<div class="tbc-mc-empty-state"><p>Error loading details</p></div>');
            }
        })
        .fail(function() {
            detailPanel.html('<div class="tbc-mc-empty-state"><p>Error loading details</p></div>');
        });
    }

    // Back button for scheduled tab (mobile)
    $(document).on('click', '.tbc-mc-scheduled-back-btn', function() {
        $('.tbc-mc-scheduled-detail-panel').removeClass('active');
    });

    // Scheduled filter buttons
    $(document).on('click', '.tbc-mc-scheduled-filter-btn', function() {
        const btn = $(this);
        const filter = btn.data('filter');

        if (filter === currentScheduledFilter) return;

        currentScheduledFilter = filter;

        // Update active state
        $('.tbc-mc-scheduled-filter-btn').removeClass('active');
        btn.addClass('active');

        // Filter items
        filterScheduledItems(filter);
    });

    function filterScheduledItems(filter) {
        const items = $('.tbc-mc-scheduled-item');

        items.each(function() {
            const item = $(this);
            const status = item.data('status');

            if (filter === 'all') {
                item.show();
            } else if (filter === 'pending' && status === 'pending') {
                item.show();
            } else if (filter === 'completed' && status === 'completed') {
                item.show();
            } else {
                item.hide();
            }
        });

        // Reset checkboxes when filter changes
        $('.tbc-mc-scheduled-select, .tbc-mc-scheduled-select-all').prop('checked', false);
        updateScheduledBulkButtons();

        // If active item is now hidden, clear the detail panel
        const activeItem = $('.tbc-mc-scheduled-item.active:visible');
        if (activeItem.length === 0) {
            $('.tbc-mc-scheduled-detail-panel').addClass('empty').html(
                '<div class="tbc-mc-empty-state"><span class="bb-icon bb-icon-clock" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></span><p>Select a scheduled message to view details</p></div>'
            );
        }
    }

    // Cancel scheduled message (from detail panel)
    $(document).on('click', '.tbc-mc-scheduled-detail-actions .tbc-mc-cancel-all-btn', function() {
        const btn = $(this);
        const parentId = btn.data('parent-id');

        if (!confirm('Cancel this scheduled message? This will prevent it from being sent.')) return;

        btn.prop('disabled', true).text('Cancelling...');

        tbcMcAjax('tbc_mc_cancel_blast', { parent_id: parentId })
        .done(function(response) {
            if (response.success) {
                showToast('success', 'Message cancelled');
                // Reload scheduled tab content
                reloadScheduledTab();
            } else {
                showToast('error', response.data?.message || 'Error cancelling message');
                btn.prop('disabled', false).html('Cancel Message');
            }
        })
        .fail(function() {
            showToast('error', 'Error cancelling message');
            btn.prop('disabled', false).html('Cancel Message');
        });
    });

    // Delete scheduled message (from detail panel)
    $(document).on('click', '.tbc-mc-scheduled-detail-actions .tbc-mc-delete-all-btn', function() {
        const btn = $(this);
        const parentId = btn.data('parent-id');

        if (!confirm('Delete this message from history? This cannot be undone.')) return;

        btn.prop('disabled', true).text('Deleting...');

        tbcMcAjax('tbc_mc_delete_blast', { parent_id: parentId })
        .done(function(response) {
            if (response.success) {
                showToast('success', 'Message deleted');
                // Reload scheduled tab content
                reloadScheduledTab();
            } else {
                showToast('error', response.data?.message || 'Error deleting message');
                btn.prop('disabled', false).html('Delete from History');
            }
        })
        .fail(function() {
            showToast('error', 'Error deleting message');
            btn.prop('disabled', false).html('Delete from History');
        });
    });

    function reloadScheduledTab() {
        const tabContent = $('.tbc-mc-tab-content[data-content="scheduled"]');
        tabContent.data('loaded', false);
        tabContent.html('<div class="tbc-mc-loading">Loading...</div>');

        tbcMcAjax('tbc_mc_load_tab_content', { tab: 'scheduled' })
        .done(function(response) {
            if (response.success) {
                tabContent.html(response.data.html).data('loaded', true);
            } else {
                tabContent.html('<div class="tbc-mc-empty-state"><p>Error loading content</p></div>');
            }
        });
    }

    // ========================================================================
    // SCHEDULED TAB - Bulk Selection
    // ========================================================================

    function getSelectedScheduledIds() {
        const ids = [];
        $('.tbc-mc-scheduled-select:checked').each(function() {
            ids.push($(this).closest('.tbc-mc-scheduled-item').data('parent-id'));
        });
        return ids;
    }

    function updateScheduledBulkButtons() {
        const totalVisible = $('.tbc-mc-scheduled-item:visible .tbc-mc-scheduled-select').length;
        const checkedCount = $('.tbc-mc-scheduled-item:visible .tbc-mc-scheduled-select:checked').length;
        const hasSelection = checkedCount > 0;

        $('.tbc-mc-scheduled-bulk-delete').prop('disabled', !hasSelection);

        // Update select all checkbox state
        $('.tbc-mc-scheduled-select-all').prop('checked', totalVisible > 0 && checkedCount === totalVisible);
    }

    // Select All checkbox
    $(document).on('change', '.tbc-mc-scheduled-select-all', function() {
        const isChecked = $(this).is(':checked');
        $('.tbc-mc-scheduled-item:visible .tbc-mc-scheduled-select').prop('checked', isChecked);
        updateScheduledBulkButtons();
    });

    // Individual checkbox change - don't trigger item click
    $(document).on('change', '.tbc-mc-scheduled-select', function(e) {
        e.stopPropagation();
        updateScheduledBulkButtons();
    });

    // Prevent item click when clicking checkbox
    $(document).on('click', '.tbc-mc-scheduled-select', function(e) {
        e.stopPropagation();
    });

    // Bulk delete button
    $(document).on('click', '.tbc-mc-scheduled-bulk-delete', function() {
        const ids = getSelectedScheduledIds();
        if (ids.length === 0) return;

        if (!confirm(`Delete ${ids.length} scheduled message(s)?`)) return;

        const btn = $(this);
        btn.prop('disabled', true);

        tbcMcAjax('tbc_mc_bulk_delete_scheduled', { parent_ids: ids })
        .done(function(response) {
            if (response.success) {
                ids.forEach(id => {
                    $(`.tbc-mc-scheduled-item[data-parent-id="${id}"]`).remove();
                });
                // Clear detail panel if viewing deleted item
                $('.tbc-mc-scheduled-detail-panel').addClass('empty').html(
                    '<div class="tbc-mc-empty-state"><span class="bb-icon bb-icon-clock" style="font-size: 48px; color: #ccc; margin-bottom: 16px;"></span><p>Select a scheduled message to view details</p></div>'
                );
                showToast('success', `${ids.length} message(s) deleted`);
                updateScheduledBulkButtons();
            } else {
                showToast('error', response.data || 'Delete failed');
                btn.prop('disabled', false);
            }
        })
        .fail(function() {
            showToast('error', 'Delete failed');
            btn.prop('disabled', false);
        });
    });

    // ========================================================================
    // SEND SMS TAB - Two Panel Navigation with Slide-over Compose
    // ========================================================================

    let currentSendType = null;
    let selectedRecipients = [];
    let selectedRoles = [];

    // Click on contact type to load detail panel
    $(document).on('click', '.tbc-mc-send-type-item', function() {
        const item = $(this);
        const type = item.data('type');

        // Set active state
        $('.tbc-mc-send-type-item').removeClass('active');
        item.addClass('active');

        // Reset selection tracking
        selectedRecipients = [];
        selectedRoles = [];
        roleUsersCache = {};
        selectedUsersByRole = {};
        currentSendType = type;

        // Load details
        loadSendDetail(type);
    });

    function loadSendDetail(type) {
        const detailPanel = $('.tbc-mc-send-detail-panel');

        detailPanel.removeClass('empty').html('<div class="tbc-mc-loading">Loading...</div>');

        // On mobile, show the detail panel
        if (window.innerWidth <= tbcMC.mobileBreakpoint) {
            detailPanel.addClass('active');
        }

        tbcMcAjax('tbc_mc_get_send_detail', { type: type })
        .done(function(response) {
            if (response.success) {
                detailPanel.html(response.data.html);
                // Initialize type-specific content
                initSendDetailContent(type);
            } else {
                detailPanel.html('<div class="tbc-mc-empty-state"><p>Error loading content</p></div>');
            }
        })
        .fail(function() {
            detailPanel.html('<div class="tbc-mc-empty-state"><p>Error loading content</p></div>');
        });
    }

    /**
     * Initialize type-specific content after loading detail panel
     */
    function initSendDetailContent(type) {
        updateSelectedCount();

        if (type === 'church_sms') {
            // Load roles dynamically with filter
            loadRoleFilter();
        } else if (type === 'ceremony') {
            // Load categories then auto-load products
            loadCeremonyCategories();
        } else if (type === 'product') {
            // Load categories then auto-load products
            loadProductCategories();
        }
    }

    // Back button for send tab (mobile)
    $(document).on('click', '.tbc-mc-send-back-btn', function() {
        $('.tbc-mc-send-detail-panel').removeClass('active');
        currentSendType = null;
    });

    // ========================================================================
    // COMPOSE SLIDE-OVER PANEL
    // ========================================================================

    // Open compose panel
    $(document).on('click', '.tbc-mc-open-compose', function() {
        if ($(this).prop('disabled')) return;
        openComposePanel();
    });

    function openComposePanel() {
        const panel = $('.tbc-mc-compose-slide');
        const overlay = $('.tbc-mc-compose-overlay');

        // Update recipient count in header
        $('.tbc-mc-compose-recipient-count').text(selectedRecipients.length + ' recipients');

        // Build contact list summary - target the form's contact section (not the outer div)
        const contactSection = panel.find('.tbc-mc-contact-section');
        if (contactSection.length && selectedRecipients.length > 0) {
            // Build summary based on contact type
            let summaryText = selectedRecipients.length + ' recipient' + (selectedRecipients.length > 1 ? 's' : '');

            if (currentSendType === 'church_sms' && selectedRoles.length > 0) {
                // Show role names for Church SMS
                const roleNames = selectedRoles.map(function(role) {
                    const roleLabel = $('.tbc-mc-role-check[value="' + role + '"]')
                        .closest('.tbc-mc-role-card')
                        .find('.tbc-mc-role-name').text();
                    return roleLabel || role;
                });
                summaryText += ' from: ' + roleNames.join(', ');
            } else if (currentSendType === 'ceremony') {
                summaryText += ' from: Ceremony Participants';
            } else if (currentSendType === 'product') {
                summaryText += ' from: Product Customers';
            } else if (currentSendType === 'manual') {
                if (selectedRecipients.length <= 3) {
                    summaryText = selectedRecipients.map(r => r.name || r.phone).join(', ');
                } else {
                    summaryText += ' (manual entry)';
                }
            }

            // Update the section content (keep h3, add summary below it)
            contactSection.find('.tbc-mc-compose-summary').remove();
            contactSection.append('<div class="tbc-mc-compose-summary">' + escapeHtml(summaryText) + '</div>');
        }

        // Update the hidden phone numbers field in the form
        updateComposeFormRecipients();

        panel.addClass('open');
        overlay.addClass('visible');
    }

    function closeComposePanel() {
        $('.tbc-mc-compose-slide').removeClass('open');
        $('.tbc-mc-compose-overlay').removeClass('visible');
    }

    $(document).on('click', '.tbc-mc-close-compose', closeComposePanel);
    $(document).on('click', '.tbc-mc-compose-overlay', closeComposePanel);

    /**
     * Update compose form with selected recipients
     */
    function updateComposeFormRecipients() {
        const form = $('.tbc-mc-compose-slide-content form');

        // Check if hidden field exists, create if not
        let hiddenField = form.find('input[name="phone_numbers"]');
        if (hiddenField.length === 0) {
            hiddenField = $('<input type="hidden" name="phone_numbers">');
            form.prepend(hiddenField);
        }

        // Set phone numbers as JSON array
        hiddenField.val(JSON.stringify(selectedRecipients));

        // Also set roles if using church_sms
        if (currentSendType === 'church_sms') {
            let rolesField = form.find('input[name="selected_roles"]');
            if (rolesField.length === 0) {
                rolesField = $('<input type="hidden" name="selected_roles">');
                form.prepend(rolesField);
            }
            rolesField.val(JSON.stringify(selectedRoles));
        }
    }

    // ========================================================================
    // CHURCH SMS - Role Selection with Individual User Display
    // ========================================================================

    // Store loaded users per role for the panel
    let roleUsersCache = {};
    let currentPanelRole = null;

    // Role checkbox change handler - shows summary with View button
    $(document).on('change', '.tbc-mc-role-check', function() {
        const checkbox = $(this);
        const role = checkbox.val();
        const roleCard = checkbox.closest('.tbc-mc-role-card');
        let summaryContainer = roleCard.find('.tbc-mc-role-users-summary');

        if (checkbox.is(':checked')) {
            // Create summary container if doesn't exist
            if (summaryContainer.length === 0) {
                summaryContainer = $('<div class="tbc-mc-role-users-summary"></div>');
                roleCard.append(summaryContainer);
            }

            // Show loading state
            summaryContainer.html('<span class="tbc-mc-loading-small">Loading...</span>');

            // Load users for this role
            tbcMcAjax('tbc_mc_fetch_by_role', { role: role })
            .done(function(response) {
                if (response.success && response.data.data && response.data.data.userList) {
                    const users = response.data.data.userList;
                    // Cache users for this role
                    roleUsersCache[role] = users;

                    // Count valid (non-opted-out) users
                    const validUsers = users.filter(u => !u.is_sms_out && u.phone && u.phone !== 'N/A');
                    const optedOut = users.length - validUsers.length;

                    // Initialize all valid users as selected
                    if (!selectedUsersByRole[role]) {
                        selectedUsersByRole[role] = validUsers.map(u => ({ phone: u.phone, name: u.name }));
                    }

                    updateRoleSummary(role, summaryContainer);
                    updateUserSelection();
                } else {
                    summaryContainer.html('<span class="tbc-mc-no-data">No users found</span>');
                }
            });
        } else {
            // Role unchecked - remove summary and clear cache
            summaryContainer.remove();
            delete roleUsersCache[role];
            delete selectedUsersByRole[role];
            updateUserSelection();
        }
    });

    // Track selected users per role
    let selectedUsersByRole = {};

    function updateRoleSummary(role, container) {
        const users = roleUsersCache[role] || [];
        const selected = selectedUsersByRole[role] || [];
        const validUsers = users.filter(u => !u.is_sms_out && u.phone && u.phone !== 'N/A');

        let html = `<span class="tbc-mc-role-users-count"><strong>${selected.length}</strong> of ${validUsers.length} selected</span>`;
        html += `<button type="button" class="tbc-mc-view-users-btn" data-role="${role}">View / Edit</button>`;
        container.html(html);
    }

    // View/Edit users button click
    $(document).on('click', '.tbc-mc-view-users-btn', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const role = $(this).data('role');
        openUsersPanel(role);
    });

    function openUsersPanel(role) {
        currentPanelRole = role;
        const users = roleUsersCache[role] || [];
        const selected = selectedUsersByRole[role] || [];
        const selectedPhones = selected.map(u => u.phone);

        // Build panel HTML
        let html = `
            <div class="tbc-mc-users-panel-header">
                <button type="button" class="tbc-mc-close-users-panel">&times;</button>
                <span class="tbc-mc-users-panel-title">${escapeHtml(role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()))}</span>
            </div>
            <div class="tbc-mc-users-panel-actions">
                <label class="tbc-mc-select-all-users">
                    <input type="checkbox" class="tbc-mc-select-all-role-users" ${selectedPhones.length === users.filter(u => !u.is_sms_out && u.phone).length ? 'checked' : ''}>
                    <span>Select All</span>
                </label>
            </div>
            <div class="tbc-mc-users-panel-content">
                <div class="tbc-mc-users-list">`;

        users.forEach(function(user) {
            const isOptedOut = user.is_sms_out;
            const hasPhone = user.phone && user.phone !== 'N/A';
            const isSelected = selectedPhones.includes(user.phone);

            if (isOptedOut) {
                html += `<div class="tbc-mc-user-item opted-out">
                    <input type="checkbox" disabled>
                    <div class="tbc-mc-user-info">
                        <span class="tbc-mc-user-name">${escapeHtml(user.name)}</span>
                        <span class="tbc-mc-user-phone">${escapeHtml(user.phone || 'No phone')}</span>
                    </div>
                    <span class="tbc-mc-opted-out-badge">Opted Out</span>
                </div>`;
            } else if (hasPhone) {
                html += `<div class="tbc-mc-user-item">
                    <input type="checkbox" class="tbc-mc-panel-user-check"
                        value="${escapeHtml(user.phone)}"
                        data-name="${escapeHtml(user.name)}"
                        ${isSelected ? 'checked' : ''}>
                    <div class="tbc-mc-user-info">
                        <span class="tbc-mc-user-name">${escapeHtml(user.name)}</span>
                        <span class="tbc-mc-user-phone">${escapeHtml(user.phone)}</span>
                    </div>
                </div>`;
            }
        });

        html += `</div>
            </div>
            <div class="tbc-mc-users-panel-footer">
                <span class="tbc-mc-users-selected-count">${selected.length} selected</span>
                <button type="button" class="tbc-mc-users-done-btn">Done</button>
            </div>`;

        // Ensure panel exists
        if ($('.tbc-mc-users-panel').length === 0) {
            $('body').append('<div class="tbc-mc-users-overlay"></div><div class="tbc-mc-users-panel"></div>');
        }

        $('.tbc-mc-users-panel').html(html).addClass('open');
        $('.tbc-mc-users-overlay').addClass('visible');
    }

    function closeUsersPanel() {
        $('.tbc-mc-users-panel').removeClass('open');
        $('.tbc-mc-users-overlay').removeClass('visible');

        // Update the summary for this role
        if (currentPanelRole) {
            const roleCard = $(`.tbc-mc-role-check[value="${currentPanelRole}"]`).closest('.tbc-mc-role-card');
            const summaryContainer = roleCard.find('.tbc-mc-role-users-summary');
            updateRoleSummary(currentPanelRole, summaryContainer);
            updateUserSelection();
        }
        currentPanelRole = null;
    }

    // Close users panel
    $(document).on('click', '.tbc-mc-close-users-panel, .tbc-mc-users-overlay, .tbc-mc-users-done-btn', closeUsersPanel);

    // Select all in panel
    $(document).on('change', '.tbc-mc-select-all-role-users', function() {
        const isChecked = $(this).is(':checked');
        $('.tbc-mc-panel-user-check').prop('checked', isChecked);
        updatePanelSelection();
    });

    // Individual user check in panel
    $(document).on('change', '.tbc-mc-panel-user-check', function() {
        updatePanelSelection();
    });

    function updatePanelSelection() {
        if (!currentPanelRole) return;

        const selected = [];
        $('.tbc-mc-panel-user-check:checked').each(function() {
            selected.push({
                phone: $(this).val(),
                name: $(this).data('name')
            });
        });

        selectedUsersByRole[currentPanelRole] = selected;
        $('.tbc-mc-users-selected-count').text(selected.length + ' selected');

        // Update select all checkbox state
        const totalCheckboxes = $('.tbc-mc-panel-user-check').length;
        const checkedCount = $('.tbc-mc-panel-user-check:checked').length;
        $('.tbc-mc-select-all-role-users').prop('checked', checkedCount === totalCheckboxes);
    }

    function updateUserSelection() {
        selectedRecipients = [];
        selectedRoles = [];

        // Collect checked roles
        $('.tbc-mc-role-check:checked').each(function() {
            selectedRoles.push($(this).val());
        });

        // Collect selected users from all roles
        Object.values(selectedUsersByRole).forEach(function(users) {
            users.forEach(function(user) {
                if (user.phone && user.phone !== 'N/A') {
                    selectedRecipients.push({ phone: user.phone, name: user.name });
                }
            });
        });

        updateSelectedCount();
    }

    // Cache for all roles data
    let allRolesCache = null;

    /**
     * Load all available roles and populate the filter dropdown
     */
    function loadRoleFilter() {
        tbcMcAjax('tbc_mc_fetch_roles', {})
        .done(function(response) {
            if (response.success && response.data.data && response.data.data.roles) {
                const roles = response.data.data.roles;
                allRolesCache = roles; // Cache for filter changes

                const select = $('#tbc-mc-role-filter-multiselect');
                select.empty();

                roles.forEach(function(role) {
                    select.append($('<option>', {
                        value: role.slug,
                        text: role.name + ' (' + role.count + ')'
                    }));
                });

                // Restore saved filter selection from localStorage
                const savedRoles = localStorage.getItem('tbc_mc_church_sms_roles');
                if (savedRoles) {
                    try {
                        select.val(JSON.parse(savedRoles));
                    } catch (e) {}
                }

                // Load role cards based on filter
                loadRoleCards(roles);
            } else {
                $('#tbc-mc-role-groups').html('<p class="tbc-mc-no-data">Failed to load roles</p>');
            }
        })
        .fail(function() {
            $('#tbc-mc-role-groups').html('<p class="tbc-mc-no-data">Error loading roles</p>');
        });
    }

    /**
     * Render role cards based on filter selection
     */
    function loadRoleCards(allRoles) {
        const container = $('#tbc-mc-role-groups');
        const filterSelection = $('#tbc-mc-role-filter-multiselect').val() || [];

        // If no filter, show all roles; otherwise filter
        const rolesToShow = filterSelection.length > 0
            ? allRoles.filter(role => filterSelection.includes(role.slug))
            : allRoles;

        if (rolesToShow.length === 0) {
            container.html('<p class="tbc-mc-no-data">No roles match your filter</p>');
            return;
        }

        let html = '';
        rolesToShow.forEach(function(role) {
            html += `
                <div class="tbc-mc-role-card" data-role="${escapeHtml(role.slug)}">
                    <div class="tbc-mc-role-checkbox">
                        <input type="checkbox" class="tbc-mc-role-check" id="role-${escapeHtml(role.slug)}" value="${escapeHtml(role.slug)}">
                    </div>
                    <label for="role-${escapeHtml(role.slug)}" class="tbc-mc-role-info">
                        <span class="tbc-mc-role-name">${escapeHtml(role.name)}</span>
                    </label>
                    <span class="tbc-mc-role-count" data-role="${escapeHtml(role.slug)}">(${role.count})</span>
                </div>
            `;
        });

        container.html(html);
    }

    /**
     * Role filter change handler - save to localStorage and refresh display
     */
    $(document).on('change', '#tbc-mc-role-filter-multiselect', function() {
        const selectedRolesFilter = $(this).val() || [];
        localStorage.setItem('tbc_mc_church_sms_roles', JSON.stringify(selectedRolesFilter));

        // Re-render cards with cached data
        if (allRolesCache) {
            loadRoleCards(allRolesCache);
        }
    });

    // ========================================================================
    // CEREMONY PARTICIPANTS - Category/Product/Date Selection
    // ========================================================================

    function loadCeremonyCategories() {
        tbcMcAjax('tbc_mc_fetch_categories', {})
        .done(function(response) {
            if (response.success && response.data.data && response.data.data.categories) {
                const select = $('#tbc-mc-category-multiselect');
                select.empty();
                response.data.data.categories.forEach(function(cat) {
                    select.append($('<option>', {
                        value: cat.slug,
                        text: cat.name + ' (' + (cat.count || 0) + ')'
                    }));
                });

                // Restore saved category selection from localStorage
                const savedCategories = localStorage.getItem('tbc_mc_ceremony_categories');
                if (savedCategories) {
                    try {
                        select.val(JSON.parse(savedCategories));
                    } catch (e) {}
                }

                // Auto-load products immediately
                loadCeremonyProducts();
            }
        });
    }

    function loadCeremonyProducts() {
        const categories = $('#tbc-mc-category-multiselect').val() || [];
        const container = $('#tbc-mc-ceremony-products');

        container.html('<div class="tbc-mc-loading">Loading products...</div>');

        tbcMcAjax('tbc_mc_fetch_products', { included_categories: categories })
        .done(function(response) {
            if (response.success && response.data.data && response.data.data.products) {
                renderProductList('#tbc-mc-ceremony-products', response.data.data.products, 'ceremony');
            } else {
                container.html('<p class="tbc-mc-no-data">No products found</p>');
            }
        });
    }

    // Ceremony category filter change - save and auto-reload
    $(document).on('change', '#tbc-mc-category-multiselect', function() {
        const selectedCategories = $(this).val() || [];
        localStorage.setItem('tbc_mc_ceremony_categories', JSON.stringify(selectedCategories));
        loadCeremonyProducts();
    });

    // ========================================================================
    // ALL PRODUCTS - Product/Date/Customer Selection
    // ========================================================================

    function loadProductCategories() {
        tbcMcAjax('tbc_mc_fetch_categories', {})
        .done(function(response) {
            if (response.success && response.data.data && response.data.data.categories) {
                const select = $('#tbc-mc-product-category-filter');
                select.empty();
                response.data.data.categories.forEach(function(cat) {
                    select.append($('<option>', {
                        value: cat.slug,
                        text: cat.name + ' (' + (cat.count || 0) + ')'
                    }));
                });

                // Restore saved category selection (separate key from ceremony)
                const savedCategories = localStorage.getItem('tbc_mc_product_categories');
                if (savedCategories) {
                    try {
                        select.val(JSON.parse(savedCategories));
                    } catch (e) {}
                }

                // Auto-load products
                loadAllProducts();
            }
        });
    }

    function loadAllProducts() {
        const categories = $('#tbc-mc-product-category-filter').val() || [];
        const container = $('#tbc-mc-all-products');

        container.html('<div class="tbc-mc-loading">Loading products...</div>');

        // If categories selected, use them; otherwise load all (simple_mode)
        const params = categories.length > 0
            ? { included_categories: categories }
            : { simple_mode: 'true' };

        tbcMcAjax('tbc_mc_fetch_products', params)
        .done(function(response) {
            if (response.success && response.data.data && response.data.data.products) {
                renderProductList('#tbc-mc-all-products', response.data.data.products, 'product');
            } else {
                container.html('<p class="tbc-mc-no-data">No products found</p>');
            }
        });
    }

    // Product category filter change - save and auto-reload
    $(document).on('change', '#tbc-mc-product-category-filter', function() {
        const selectedCategories = $(this).val() || [];
        localStorage.setItem('tbc_mc_product_categories', JSON.stringify(selectedCategories));
        loadAllProducts();
    });

    /**
     * Render product list with expandable dates
     */
    function renderProductList(container, products, mode) {
        const $container = $(container);
        $container.empty();

        if (!products || products.length === 0) {
            $container.html('<p class="tbc-mc-no-data">No products found</p>');
            return;
        }

        products.forEach(function(product) {
            const item = $(`
                <div class="tbc-mc-hierarchy-item" data-product-id="${product.id}" data-mode="${mode}">
                    <div class="tbc-mc-hierarchy-header">
                        <span class="tbc-mc-hierarchy-expand">▶</span>
                        <span class="tbc-mc-hierarchy-title">${escapeHtml(product.name)}</span>
                    </div>
                    <div class="tbc-mc-hierarchy-children" style="display: none;"></div>
                </div>
            `);
            $container.append(item);
        });
    }

    // Expand/collapse product - loads dates (ceremony) or customers directly (product)
    $(document).on('click', '.tbc-mc-hierarchy-header', function() {
        const item = $(this).closest('.tbc-mc-hierarchy-item');
        const children = item.find('> .tbc-mc-hierarchy-children');
        const expand = $(this).find('.tbc-mc-hierarchy-expand');
        const productId = item.data('product-id');
        const mode = item.data('mode');

        if (children.is(':visible')) {
            children.slideUp(200);
            expand.text('▶');
        } else {
            // Load content if not already loaded
            if (!children.data('loaded')) {
                children.html('<div class="tbc-mc-loading-small">Loading...</div>');

                // Branch based on mode
                if (mode === 'product') {
                    // All Users of a Product - load customers directly (no dates)
                    loadCustomersForProduct(productId, children);
                } else {
                    // Ceremony Participants - load dates first
                    loadDatesForProduct(productId, children);
                }
            }
            children.slideDown(200);
            expand.text('▼');
        }
    });

    function loadDatesForProduct(productId, container) {
        tbcMcAjax('tbc_mc_fetch_dates_for_product', { product_id: productId })
        .done(function(response) {
            container.data('loaded', true);
            // FIX: Use nested response structure
            if (response.success && response.data.data && response.data.data.dates && response.data.data.dates.length > 0) {
                container.empty();
                response.data.data.dates.forEach(function(date) {
                    const dateItem = $(`
                        <div class="tbc-mc-date-item" data-product-id="${productId}" data-date="${date.date}">
                            <div class="tbc-mc-date-header">
                                <span class="tbc-mc-hierarchy-expand">▶</span>
                                <span class="tbc-mc-date-label">${date.formatted || date.date}</span>
                            </div>
                            <div class="tbc-mc-date-customers" style="display: none;"></div>
                        </div>
                    `);
                    container.append(dateItem);
                });
            } else {
                container.html('<p class="tbc-mc-no-data">No dates found</p>');
            }
        });
    }

    // Expand/collapse date to show customers
    $(document).on('click', '.tbc-mc-date-header', function(e) {
        e.stopPropagation();
        const item = $(this).closest('.tbc-mc-date-item');
        const customers = item.find('> .tbc-mc-date-customers');
        const expand = $(this).find('.tbc-mc-hierarchy-expand');
        const productId = item.data('product-id');
        const date = item.data('date');

        if (customers.is(':visible')) {
            customers.slideUp(200);
            expand.text('▶');
        } else {
            // Load customers if not already loaded
            if (!customers.data('loaded')) {
                customers.html('<div class="tbc-mc-loading-small">Loading customers...</div>');
                loadCustomersForDate(productId, date, customers);
            }
            customers.slideDown(200);
            expand.text('▼');
        }
    });

    function loadCustomersForDate(productId, date, container) {
        // FIX: product_id parameter expects composite format: productId|date
        tbcMcAjax('tbc_mc_fetch_customers', { product_id: productId + '|' + date })
        .done(function(response) {
            container.data('loaded', true);
            // FIX: Use nested response structure AND correct property name (customerList)
            if (response.success && response.data.data && response.data.data.customerList && response.data.data.customerList.length > 0) {
                const customers = response.data.data.customerList;
                container.empty();

                // Add "Select All" checkbox
                const selectAll = $(`
                    <div class="tbc-mc-customer-select-all">
                        <label>
                            <input type="checkbox" class="tbc-mc-select-all-customers" data-product-id="${productId}" data-date="${date}">
                            Select All (${customers.length})
                        </label>
                    </div>
                `);
                container.append(selectAll);

                customers.forEach(function(customer) {
                    const isOptedOut = customer.is_sms_out;
                    const optOut = isOptedOut ? ' <span class="tbc-mc-opted-out">(Opted Out)</span>' : '';
                    const disabled = isOptedOut ? ' disabled' : '';
                    const customerItem = $(`
                        <div class="tbc-mc-customer-item${isOptedOut ? ' opted-out' : ''}">
                            <label>
                                <input type="checkbox" class="tbc-mc-customer-check"
                                    value="${escapeHtml(customer.phone)}"
                                    data-name="${escapeHtml(customer.name || '')}"
                                    ${disabled}>
                                <span class="tbc-mc-customer-name">${escapeHtml(customer.name || 'Unknown')}</span>
                                <span class="tbc-mc-customer-phone">${escapeHtml(customer.phone)}</span>
                                ${optOut}
                            </label>
                        </div>
                    `);
                    container.append(customerItem);
                });
            } else {
                container.html('<p class="tbc-mc-no-data">No customers found</p>');
            }
        });
    }

    /**
     * Load ALL customers for a product (no date filtering)
     * Used by "All Users of a Product" mode
     */
    function loadCustomersForProduct(productId, container) {
        // Pass product_id without date - backend returns ALL customers for that product
        tbcMcAjax('tbc_mc_fetch_customers', { product_id: productId })
        .done(function(response) {
            container.data('loaded', true);
            if (response.success && response.data.data && response.data.data.customerList && response.data.data.customerList.length > 0) {
                const customers = response.data.data.customerList;
                container.empty();

                // Add "Select All" checkbox
                const selectAll = $(`
                    <div class="tbc-mc-customer-select-all">
                        <label>
                            <input type="checkbox" class="tbc-mc-select-all-customers" data-product-id="${productId}">
                            Select All (${customers.length})
                        </label>
                    </div>
                `);
                container.append(selectAll);

                customers.forEach(function(customer) {
                    const isOptedOut = customer.is_sms_out;
                    const optOut = isOptedOut ? ' <span class="tbc-mc-opted-out">(Opted Out)</span>' : '';
                    const disabled = isOptedOut ? ' disabled' : '';
                    const customerItem = $(`
                        <div class="tbc-mc-customer-item${isOptedOut ? ' opted-out' : ''}">
                            <label>
                                <input type="checkbox" class="tbc-mc-customer-check"
                                    value="${escapeHtml(customer.phone)}"
                                    data-name="${escapeHtml(customer.name || '')}"
                                    ${disabled}>
                                <span class="tbc-mc-customer-name">${escapeHtml(customer.name || 'Unknown')}</span>
                                <span class="tbc-mc-customer-phone">${escapeHtml(customer.phone)}</span>
                                ${optOut}
                            </label>
                        </div>
                    `);
                    container.append(customerItem);
                });
            } else {
                container.html('<p class="tbc-mc-no-data">No customers found</p>');
            }
        })
        .fail(function() {
            container.html('<p class="tbc-mc-error">Error loading customers</p>');
        });
    }

    // Select all customers for a date
    $(document).on('change', '.tbc-mc-select-all-customers', function() {
        const isChecked = $(this).prop('checked');
        const container = $(this).closest('.tbc-mc-date-customers');
        container.find('.tbc-mc-customer-check:not(:disabled)').prop('checked', isChecked);
        updateCustomerSelection();
    });

    // Individual customer checkbox change
    $(document).on('change', '.tbc-mc-customer-check', function() {
        updateCustomerSelection();
    });

    function updateCustomerSelection() {
        selectedRecipients = [];

        $('.tbc-mc-customer-check:checked').each(function() {
            const phone = $(this).val();
            const name = $(this).data('name');
            if (phone) {
                selectedRecipients.push({ phone: phone, name: name });
            }
        });

        updateSelectedCount();
    }

    // ========================================================================
    // MANUAL NUMBERS - Parse and Validate
    // ========================================================================

    $(document).on('click', '.tbc-mc-parse-numbers-btn', function() {
        const textarea = $('#tbc-mc-manual-numbers');
        const input = textarea.val().trim();

        if (!input) {
            showToast('error', 'Please enter phone numbers');
            return;
        }

        // Parse numbers - split by newline, comma, or semicolon
        const raw = input.split(/[\n,;]+/).map(s => s.trim()).filter(s => s);
        const validNumbers = [];
        const invalidNumbers = [];

        raw.forEach(function(num) {
            // Clean the number
            const cleaned = num.replace(/[\s\-\(\)\.]/g, '');
            // Basic validation: at least 10 digits
            if (/^\+?\d{10,}$/.test(cleaned)) {
                validNumbers.push({
                    original: num,
                    cleaned: cleaned
                });
            } else if (num) {
                invalidNumbers.push(num);
            }
        });

        // Display results
        const resultsSection = $('#tbc-mc-parsed-results');
        const validList = resultsSection.find('.tbc-mc-valid-numbers-list');
        const invalidSection = resultsSection.find('.tbc-mc-invalid-numbers-alert');
        const invalidList = resultsSection.find('.tbc-mc-invalid-numbers-list');

        validList.empty();
        invalidList.empty();

        if (validNumbers.length > 0) {
            validNumbers.forEach(function(num) {
                validList.append(`
                    <div class="tbc-mc-parsed-number-item">
                        <input type="checkbox" class="tbc-mc-manual-number-check" value="${num.cleaned}" checked>
                        <span>${escapeHtml(num.original)}</span>
                    </div>
                `);
            });
            resultsSection.show();
        } else {
            resultsSection.hide();
        }

        if (invalidNumbers.length > 0) {
            invalidNumbers.forEach(function(num) {
                invalidList.append(`<div class="tbc-mc-invalid-number">${escapeHtml(num)}</div>`);
            });
            invalidSection.show();
        } else {
            invalidSection.hide();
        }

        // Update selection
        updateManualSelection();
    });

    // Manual number checkbox change
    $(document).on('change', '.tbc-mc-manual-number-check', function() {
        updateManualSelection();
    });

    function updateManualSelection() {
        selectedRecipients = [];

        $('.tbc-mc-manual-number-check:checked').each(function() {
            const phone = $(this).val();
            if (phone) {
                selectedRecipients.push({ phone: phone });
            }
        });

        updateSelectedCount();
    }

    // ========================================================================
    // SHARED - Update Selected Count and Compose Button
    // ========================================================================

    function updateSelectedCount() {
        const count = selectedRecipients.length;
        const countText = count === 1 ? '1 recipient selected' : `${count} recipients selected`;

        $('.tbc-mc-selected-count').text(countText);
        $('.tbc-mc-open-compose').prop('disabled', count === 0);
    }

    /**
     * Helper to escape HTML
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================================================
    // COMPOSE FORM SUBMISSION
    // ========================================================================

    // Handle form submission in compose slide
    $(document).on('submit', '.tbc-mc-compose-slide-content form', function(event) {
        event.preventDefault();

        const form = $(this);

        // Make sure recipients are set
        updateComposeFormRecipients();

        if (window.handleSMSFormSubmission) {
            const success = window.handleSMSFormSubmission(form, 'Batch SMS');

            // Only close panel if submission was accepted
            if (success) {
                setTimeout(function() {
                    closeComposePanel();
                    // Reset selection
                    selectedRecipients = [];
                    selectedRoles = [];
                    updateSelectedCount();
                }, 2000);
            }
        }
    });

    // Add escape key handler for compose panel
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && $('.tbc-mc-compose-slide').hasClass('open')) {
            closeComposePanel();
        }
    });

});
