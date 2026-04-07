document.addEventListener('DOMContentLoaded', function() {
    initializeCheckboxes();
    initializeCopyButtons();
});

function initializeCheckboxes() {
    var selectAll = document.getElementById('select-all');
    var selectAllHeader = document.getElementById('select-all-header');
    var checkboxes = document.querySelectorAll('.member-checkbox');

    function syncSelectAll() {
        var checkedCount = 0;
        checkboxes.forEach(function(cb) { if (cb.checked) checkedCount++; });

        var allChecked = checkedCount === checkboxes.length && checkboxes.length > 0;
        var someChecked = checkedCount > 0 && !allChecked;

        if (selectAll) {
            selectAll.checked = allChecked;
            selectAll.indeterminate = someChecked;
        }
        if (selectAllHeader) {
            selectAllHeader.checked = allChecked;
            selectAllHeader.indeterminate = someChecked;
        }

        var countEl = document.getElementById('selected-count');
        if (countEl) countEl.textContent = checkedCount + ' selected';
    }

    function toggleAll(checked) {
        checkboxes.forEach(function(cb) { cb.checked = checked; });
        syncSelectAll();
    }

    if (selectAll) selectAll.addEventListener('change', function() { toggleAll(this.checked); });
    if (selectAllHeader) selectAllHeader.addEventListener('change', function() { toggleAll(this.checked); });
    checkboxes.forEach(function(cb) { cb.addEventListener('change', syncSelectAll); });
}

function initializeCopyButtons() {
    var copyNames = document.getElementById('copy-names');
    var copyMentions = document.getElementById('copy-mentions');

    if (copyNames) {
        copyNames.addEventListener('click', function() {
            var members = getSelectedMembers();
            if (members.length === 0) {
                showNotification('Select members first (or use Select All)', 'error');
                return;
            }
            var text = members.map(function(m) { return m.name; }).join('\n');
            copyToClipboard(text, this);
        });
    }

    if (copyMentions) {
        copyMentions.addEventListener('click', function() {
            var members = getSelectedMembers();
            if (members.length === 0) {
                showNotification('Select members first (or use Select All)', 'error');
                return;
            }
            var text = members.map(function(m) { return '@' + m.username; }).join(' ');
            copyToClipboard(text, this);
        });
    }
}

function getSelectedMembers() {
    var checked = document.querySelectorAll('.member-checkbox:checked');
    return Array.from(checked).map(function(cb) {
        return { id: cb.value, name: cb.dataset.name, username: cb.dataset.username };
    });
}

function showCopiedFeedback(button) {
    var original = button.textContent;
    button.textContent = 'Copied!';
    button.classList.add('copied');
    setTimeout(function() {
        button.textContent = original;
        button.classList.remove('copied');
    }, 2000);
}

function copyToClipboard(text, button) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showCopiedFeedback(button);
        });
    } else {
        var textarea = document.getElementById('copy-source');
        if (textarea) {
            textarea.value = text;
            textarea.select();
            document.execCommand('copy');
            showCopiedFeedback(button);
        }
    }
}

function showNotification(message, type) {
    type = type || 'info';
    var notification = document.createElement('div');
    notification.className = 'tbc-notification tbc-notification-' + type;

    var content = document.createElement('div');
    content.className = 'tbc-notification-content';

    var p = document.createElement('p');
    p.textContent = message;

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tbc-notification-close';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', function() { notification.remove(); });

    content.appendChild(p);
    content.appendChild(closeBtn);
    notification.appendChild(content);

    var container = document.querySelector('.members-page-container');
    if (container) {
        container.insertBefore(notification, container.firstChild);
        setTimeout(function() {
            if (document.body.contains(notification)) notification.remove();
        }, 4000);
    }
}
