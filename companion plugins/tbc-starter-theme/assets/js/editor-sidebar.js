(function (wp) {
    if (!wp || !wp.plugins) {
        return;
    }

    var registerPlugin = wp.plugins.registerPlugin;
    var PluginDocumentSettingPanel =
        (wp.editPost && wp.editPost.PluginDocumentSettingPanel) ||
        (wp.editor && wp.editor.PluginDocumentSettingPanel);
    var ToggleControl = wp.components.ToggleControl;
    var useSelect = wp.data.useSelect;
    var useDispatch = wp.data.useDispatch;
    var createElement = wp.element.createElement;
    var __ = wp.i18n.__;

    if (!PluginDocumentSettingPanel) {
        return;
    }

    function HideTitlePanel() {
        var postType = useSelect(function (select) {
            return select('core/editor').getCurrentPostType();
        }, []);

        if (postType !== 'page') {
            return null;
        }

        var hidden = useSelect(function (select) {
            var meta = select('core/editor').getEditedPostAttribute('meta');
            return !!(meta && meta._tbc_hide_title);
        }, []);

        var editPost = useDispatch('core/editor').editPost;

        return createElement(
            PluginDocumentSettingPanel,
            {
                name: 'tbc-hide-title',
                title: __('Page Title', 'fluent-starter'),
                className: 'tbc-hide-title-panel'
            },
            createElement(ToggleControl, {
                label: __('Hide page title', 'fluent-starter'),
                help: __('Skip rendering the H1 on the front end of this page.', 'fluent-starter'),
                checked: hidden,
                onChange: function (value) {
                    editPost({ meta: { _tbc_hide_title: value } });
                }
            })
        );
    }

    registerPlugin('tbc-hide-title', { render: HideTitlePanel });
})(window.wp);
