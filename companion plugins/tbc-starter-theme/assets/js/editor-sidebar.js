(function (wp) {
    if (!wp || !wp.plugins || !wp.editor) {
        return;
    }

    var registerPlugin = wp.plugins.registerPlugin;
    var PluginDocumentSettingPanel =
        (wp.editor && wp.editor.PluginDocumentSettingPanel) ||
        (wp.editPost && wp.editPost.PluginDocumentSettingPanel);
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

        var meta = useSelect(function (select) {
            return select('core/editor').getEditedPostAttribute('meta') || {};
        }, []);

        var editPost = useDispatch('core/editor').editPost;
        var hidden = !!meta._tbc_hide_title;

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
