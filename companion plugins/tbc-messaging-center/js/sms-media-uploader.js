jQuery(document).ready(function($) {
    $(document).on('click', '.tbc-mc-media-upload-button', function(e) {
        e.preventDefault();
        const form = $(this).closest('form'); 

        let customUploader = wp.media({
            title: 'Choose Media',
            button: {
                text: 'Choose Media'
            },
            multiple: true
        });

        customUploader.on('select', function() {
            const attachments = customUploader.state().get('selection').toJSON();
            
            if (attachments && attachments.length > 0) {
                const previewContainer = form.find('.tbc-mc-media-preview');
                
                // Get existing URLs
                const existingUrls = form.find('.tbc-mc-media-url').val();
                const urlArray = existingUrls ? existingUrls.split(',').filter(u => u.trim()) : [];
                
                // Add new URLs and create thumbnails
                attachments.forEach(function(attachment) {
                    // Skip if already added
                    if (urlArray.includes(attachment.url)) {
                        return;
                    }
                    
                    // Add to array (max 10 total)
                    if (urlArray.length < 10) {
                        urlArray.push(attachment.url);
                        
                        const thumbnailUrl = attachment.sizes && attachment.sizes.thumbnail 
                            ? attachment.sizes.thumbnail.url 
                            : attachment.url;
                        
                        const itemHtml = `
                            <div class="tbc-mc-media-item" data-url="${attachment.url}">
                                <img src="${thumbnailUrl}" alt="Preview" class="tbc-mc-media-thumbnail" />
                                <span class="tbc-mc-remove-media" data-url="${attachment.url}">&times;</span>
                            </div>
                        `;
                        previewContainer.append(itemHtml);
                    }
                });
                
                // Update hidden field with all URLs
                form.find('.tbc-mc-media-url').val(urlArray.join(','));
                
                // Show preview container if we have media
                if (urlArray.length > 0) {
                    previewContainer.show();
                    form.find('input[name="send_as_mms"]').prop('checked', true);
                }
                
                form.find('textarea[name="sms_message"]').trigger('keyup'); 
            }
        });

        customUploader.open();
    });
    
    // Remove individual media item
    $(document).on('click', '.tbc-mc-remove-media', function() {
        const form = $(this).closest('form');
        const urlToRemove = $(this).data('url');
        const currentUrls = form.find('.tbc-mc-media-url').val().split(',').filter(u => u.trim());
        
        // Remove this URL
        const newUrls = currentUrls.filter(url => url !== urlToRemove);
        
        // Update hidden field
        form.find('.tbc-mc-media-url').val(newUrls.join(','));
        
        // Remove visual element
        $(this).closest('.tbc-mc-media-item').remove();
        
        // If no media left, hide container
        if (newUrls.length === 0) {
            form.find('.tbc-mc-media-preview').hide();
            form.find('input[name="send_as_mms"]').prop('checked', false);
        }
        
        form.find('textarea[name="sms_message"]').trigger('keyup');
    });
    
    // Prevent MMS toggle from being turned off when media attachments exist
    $(document).on('change', 'input[name="send_as_mms"]', function() {
        const form = $(this).closest('form');
        const mediaUrl = form.find('.tbc-mc-media-url').val();
        const hasMedia = mediaUrl && mediaUrl.trim() !== '';
        
        // If media exists and user tries to disable MMS, prevent it and show alert
        if (hasMedia && !$(this).is(':checked')) {
            $(this).prop('checked', true);
            alert('Cannot send as SMS when media attachments are present. Remove all attachments first to send as SMS.');
        }
    });
});