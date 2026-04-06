/**
 * Post Settings JavaScript
 *
 * Uses EasyMDE markdown editor for template content.
 *
 * @package TBC_Participant_Frontend
 * @since 4.2.0
 */
jQuery(document).ready(function($) {
    'use strict';

    var tbcPFEditor = null;

    function tbcPFInitEditor() {
        if (tbcPFEditor) return;
        var el = document.getElementById('tbc-pf-template-content');
        if (!el) return;
        tbcPFEditor = new EasyMDE({
            element: el,
            toolbar: [
                'heading-1', 'heading-2', 'heading-3', '|',
                'bold', 'italic', '|',
                'unordered-list', 'ordered-list', '|',
                'link', '|',
                'preview', 'side-by-side', '|',
                'guide'
            ],
            spellChecker: false,
            status: false,
            minHeight: '300px',
            placeholder: 'Write your post content in markdown...'
        });
    }

    function tbcPFGetEditorContent() {
        return tbcPFEditor ? tbcPFEditor.value() : $('#tbc-pf-template-content').val();
    }

    function tbcPFSetEditorContent(content) {
        if (tbcPFEditor) {
            tbcPFEditor.value(content || '');
        } else {
            $('#tbc-pf-template-content').val(content || '');
        }
    }

    function tbcPFMakeAjaxRequest(action, data, successCallback, errorCallback) {
        $.ajax({
            url: tbcPFAjax.ajaxurl,
            type: 'POST',
            dataType: 'json',
            data: $.extend({action: action}, data),
            success: function(response) {
                if (response.success) {
                    if (successCallback) successCallback(response);
                } else {
                    var errorMsg = 'Error: ' + (response.data?.message || 'Unknown error');
                    if (errorCallback) {
                        errorCallback(errorMsg);
                    } else {
                        alert(errorMsg);
                    }
                }
            },
            error: function(xhr, status, error) {
                var errorMsg = 'Error: ' + error;
                if (errorCallback) {
                    errorCallback(errorMsg);
                } else {
                    alert(errorMsg);
                }
            }
        });
    }

    var tbcPFCurrentMediaImages = [];
    var tbcPFCurrentMediaVideos = [];

    $(document).on('click', '#tbc-pf-add-new-template', function() {
        $('#tbc-pf-template-modal-title').text('Add New Template');
        $('#tbc-pf-template-form')[0].reset();
        $('#tbc-pf-template-id').val('');
        tbcPFCurrentMediaImages = [];
        tbcPFCurrentMediaVideos = [];
        $('#tbc-pf-image-previews').empty();
        $('#tbc-pf-video-previews').empty();
        $('#tbc-pf-modal-template').show();
        tbcPFInitEditor();
        tbcPFSetEditorContent('');
    });

    $(document).on('click', '.tbc-pf-edit-template-btn', function() {
        var templateId = $(this).data('template-id');

        tbcPFMakeAjaxRequest(
            'tbc_pf_get_post_type',
            {id: templateId},
            function(response) {
                var template = response.data;

                $('#tbc-pf-template-modal-title').text('Edit Template');
                $('#tbc-pf-template-id').val(template.id);
                $('#tbc-pf-template-title').val(template.title);
                $('#tbc-pf-template-post-title').val(template.post_title);
                $('#tbc-pf-template-author').val(template.author_user_id);
                $('#tbc-pf-template-schedule').val(template.schedule_timing);

                tbcPFCurrentMediaImages = template.media_images || [];
                tbcPFCurrentMediaVideos = template.media_videos || [];

                tbcPFRenderMediaPreviews();

                $('#tbc-pf-modal-template').show();
                tbcPFInitEditor();
                tbcPFSetEditorContent(template.content);
            }
        );
    });

    $(document).on('click', '#tbc-pf-modal-template .tbc-pf-close-modal, #tbc-pf-modal-template .tbc-pf-close-modal-top', function() {
        $('#tbc-pf-modal-template').hide();
    });

    $(document).on('click', '.tbc-pf-add-media-btn', function(e) {
        e.preventDefault();

        var mediaType = $(this).data('media-type');
        var isImage = mediaType === 'image';

        var mediaUploader = wp.media({
            title: 'Select ' + (isImage ? 'Image' : 'Video'),
            button: {text: 'Use this ' + (isImage ? 'image' : 'video')},
            library: {type: isImage ? 'image' : 'video'},
            multiple: true
        });

        mediaUploader.on('select', function() {
            var selections = mediaUploader.state().get('selection');

            selections.each(function(attachment) {
                var attachmentData = attachment.toJSON();

                var mediaItem = {
                    id: attachmentData.id,
                    url: attachmentData.url,
                    thumb: attachmentData.sizes?.thumbnail?.url || attachmentData.url
                };

                if (isImage) {
                    tbcPFCurrentMediaImages.push(mediaItem);
                } else {
                    tbcPFCurrentMediaVideos.push(mediaItem);
                }
            });

            tbcPFRenderMediaPreviews();
        });

        mediaUploader.open();
    });

    function tbcPFRenderMediaPreviews() {
        var imageContainer = $('#tbc-pf-image-previews');
        imageContainer.empty();

        tbcPFCurrentMediaImages.forEach(function(media, index) {
            var preview = $('<div class="tbc-pf-media-preview">' +
                '<img src="' + media.thumb + '" alt="">' +
                '<button type="button" class="tbc-pf-remove-media-btn" data-type="image" data-index="' + index + '">\u2715</button>' +
                '</div>');
            imageContainer.append(preview);
        });

        var videoContainer = $('#tbc-pf-video-previews');
        videoContainer.empty();

        tbcPFCurrentMediaVideos.forEach(function(media, index) {
            var preview = $('<div class="tbc-pf-media-preview">' +
                '<video src="' + media.url + '" width="100"></video>' +
                '<button type="button" class="tbc-pf-remove-media-btn" data-type="video" data-index="' + index + '">\u2715</button>' +
                '</div>');
            videoContainer.append(preview);
        });
    }

    $(document).on('click', '.tbc-pf-remove-media-btn', function() {
        var type = $(this).data('type');
        var index = $(this).data('index');

        if (type === 'image') {
            tbcPFCurrentMediaImages.splice(index, 1);
        } else {
            tbcPFCurrentMediaVideos.splice(index, 1);
        }

        tbcPFRenderMediaPreviews();
    });

    $(document).on('submit', '#tbc-pf-template-form', function(e) {
        e.preventDefault();

        var templateId = $('#tbc-pf-template-id').val();
        var isEdit = templateId !== '';
        var content = tbcPFGetEditorContent();

        var formData = {
            title: $('#tbc-pf-template-title').val(),
            post_title: $('#tbc-pf-template-post-title').val(),
            content: content,
            author_user_id: $('#tbc-pf-template-author').val(),
            schedule_timing: $('#tbc-pf-template-schedule').val(),
            media_images: JSON.stringify(tbcPFCurrentMediaImages),
            media_videos: JSON.stringify(tbcPFCurrentMediaVideos)
        };

        if (isEdit) {
            formData.id = templateId;
        }

        var action = isEdit ? 'tbc_pf_update_post_type' : 'tbc_pf_create_post_type';

        tbcPFMakeAjaxRequest(
            action,
            formData,
            function(response) {
                alert(response.data.message);
                $('#tbc-pf-modal-template').hide();
                location.reload();
            }
        );
    });

    $(document).on('click', '.tbc-pf-delete-template-btn', function() {
        if (!confirm('Delete this template? This will not affect already scheduled posts.')) return;

        tbcPFMakeAjaxRequest(
            'tbc_pf_delete_post_type',
            {id: $(this).data('template-id')},
            function(response) {
                alert(response.data.message);
                location.reload();
            }
        );
    });
});
