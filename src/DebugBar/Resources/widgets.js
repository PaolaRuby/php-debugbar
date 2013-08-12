if (typeof(PhpDebugBar) == 'undefined') {
    // namespace
    var PhpDebugBar = {};
}

(function($) {

    /**
     * @namespace
     */
    PhpDebugBar.Widgets = {};

    /**
     * Replaces spaces with &nbsp; and line breaks with <br>
     * 
     * @param {String} text
     * @return {String}
     */
    var htmlize = PhpDebugBar.Widgets.htmlize = function(text) {
        return text.replace(/\n/g, '<br>').replace(/\s/g, "&nbsp;")
    };

    /**
     * Returns a string representation of value, using JSON.stringify
     * if it's an object.
     * 
     * @param {Object} value
     * @param {Boolean} prettify Uses htmlize() if true
     * @return {String}
     */
    var renderValue = PhpDebugBar.Widgets.renderValue = function(value, prettify) {
        if (typeof(value) !== 'string') {
            if (prettify) {
                return htmlize(JSON.stringify(value, undefined, 2));
            }
            return JSON.stringify(value);
        }
        return value;
    };


    // ------------------------------------------------------------------
    // Generic widgets
    // ------------------------------------------------------------------

    /**
     * Displays array element in a <ul> list
     *
     * Options:
     *  - data
     *  - itemRenderer: a function used to render list items (optional)
     */
    var ListWidget = PhpDebugBar.Widgets.ListWidget = PhpDebugBar.Widget.extend({

        tagName: 'ul',

        className: 'phpdebugbar-widgets-list',

        initialize: function(options) {
            if (!options['itemRenderer']) {
                options['itemRenderer'] = this.itemRenderer;
            }
            this.set(options);
        },

        render: function() {
            this.bindAttr(['itemRenderer', 'data'], function() {
                this.$el.empty();
                if (!this.has('data')) {
                    return;
                }

                var data = this.get('data');
                for (var i = 0; i < data.length; i++) {
                    var li = $('<li class="list-item" />').appendTo(this.$el);
                    this.get('itemRenderer')(li, data[i]);
                }
            });
        },

        /**
         * Renders the content of a <li> element
         *
         * @param {jQuery} li The <li> element as a jQuery Object
         * @param {Object} value An item from the data array
         */
        itemRenderer: function(li, value) {
            li.html(renderValue(value));
        }

    });

    // ------------------------------------------------------------------

    /**
     * Displays object property/value paris in a <dl> list
     *
     * Options:
     *  - data
     *  - itemRenderer: a function used to render list items (optional)
     */
    var KVListWidget = PhpDebugBar.Widgets.KVListWidget = ListWidget.extend({

        tagName: 'dl',

        className: 'phpdebugbar-widgets-kvlist',

        render: function() {
            this.bindAttr(['itemRenderer', 'data'], function() {
                this.$el.empty();
                if (!this.has('data')) {
                    return;
                }

                var self = this;
                $.each(this.get('data'), function(key, value) {
                    var dt = $('<dt class="key" />').appendTo(self.$el);
                    var dd = $('<dd class="value" />').appendTo(self.$el);
                    self.get('itemRenderer')(dt, dd, key, value);
                });
            });
        },

        /**
         * Renders the content of the <dt> and <dd> elements
         *
         * @param {jQuery} dt The <dt> element as a jQuery Object
         * @param {jQuery} dd The <dd> element as a jQuery Object
         * @param {String} key Property name
         * @param {Object} value Property value
         */
        itemRenderer: function(dt, dd, key, value) {
            dt.text(key);
            dd.html(htmlize(value));
        }

    });

    // ------------------------------------------------------------------
    
    /**
     * An extension of KVListWidget where the data represents a list
     * of variables
     * 
     * Options:
     *  - data
     */
    var VariableListWidget = PhpDebugBar.Widgets.VariableListWidget = KVListWidget.extend({

        className: 'phpdebugbar-widgets-kvlist phpdebugbar-widgets-varlist',

        itemRenderer: function(dt, dd, key, value) {
            dt.text(key);

            var v = value;
            if (v.length > 100) {
                v = v.substr(0, 100) + "...";
            }
            dd.text(v).click(function() {
                if (dd.hasClass('pretty')) {
                    dd.text(v).removeClass('pretty');
                } else {
                    dd.html(htmlize(value)).addClass('pretty');
                }
            });
        }

    });

    // ------------------------------------------------------------------
    
    /**
     * Iframe widget
     *
     * Options:
     *  - data
     */
    var IFrameWidget = PhpDebugBar.Widgets.IFrameWidget = PhpDebugBar.Widget.extend({

        tagName: 'iframe',

        className: 'phpdebugbar-widgets-iframe',

        render: function() {
            this.$el.attr({
                seamless: "seamless",
                border: "0",
                width: "100%",
                height: "100%"
            });
            this.bindAttr('data', function(url) { this.$el.attr('src', url); });
        }

    });


    // ------------------------------------------------------------------
    // Collector specific widgets
    // ------------------------------------------------------------------

    /**
     * Widget for the MessagesCollector
     *
     * Uses ListWidget under the hood
     *
     * Options:
     *  - data
     */
    var MessagesWidget = PhpDebugBar.Widgets.MessagesWidget = PhpDebugBar.Widget.extend({

        className: 'phpdebugbar-widgets-messages',

        render: function() {
            var self = this;

            this.$list = new ListWidget({ itemRenderer: function(li, value) {
                var m = value.message;
                if (m.length > 100) {
                    m = m.substr(0, 100) + "...";
                }

                var val = $('<span class="value" />').addClass(value.label).text(m).appendTo(li);
                if (!value.is_string || value.message.length > 100) {
                    li.css('cursor', 'pointer').click(function() {
                        if (val.hasClass('pretty')) {
                            val.text(m).removeClass('pretty');
                        } else {
                            val.html(htmlize(value.message)).addClass('pretty');
                        }
                    });
                }

                $('<span class="label" />').text(value.label).appendTo(li);
                if (value.collector) {
                    $('<span class="collector" />').text(value.collector).appendTo(li);
                }
            }});

            this.$list.$el.appendTo(this.$el);
            this.$toolbar = $('<div class="toolbar"><i class="icon-search"></i></div>').appendTo(this.$el);

            $('<input type="text" />')
                .on('change', function() { self.set('search', this.value); })
                .appendTo(this.$toolbar);

            this.bindAttr('data', function(data) {
                this.set({ exclude: [], search: '' });
                this.$toolbar.find('.filter').remove();

                var filters = [], self = this;
                for (var i = 0; i < data.length; i++) {
                    if ($.inArray(data[i].label, filters) > -1) {
                        continue;
                    }
                    filters.push(data[i].label);
                    $('<a class="filter" href="javascript:" />')
                        .text(data[i].label)
                        .attr('rel', data[i].label)
                        .on('click', function() { self.onFilterClick(this); })
                        .appendTo(this.$toolbar);
                }
            });

            this.bindAttr(['exclude', 'search'], function() {
                var data = this.get('data'),
                    exclude = this.get('exclude'), 
                    search = this.get('search'),
                    fdata = [];

                for (var i = 0; i < data.length; i++) {
                    if ($.inArray(data[i].label, exclude) === -1 && (!search || data[i].message.indexOf(search) > -1)) {
                        fdata.push(data[i]);
                    }
                }

                this.$list.set('data', fdata);
            });
        },

        onFilterClick: function(el) {
            $(el).toggleClass('excluded');

            var excludedLabels = [];
            this.$toolbar.find('.filter.excluded').each(function() {
                excludedLabels.push(this.rel);
            });

            this.set('exclude', excludedLabels);
        }

    });

    // ------------------------------------------------------------------

    /**
     * Widget for the TimeDataCollector
     *
     * Options:
     *  - data
     */
    var TimelineWidget = PhpDebugBar.Widgets.TimelineWidget = PhpDebugBar.Widget.extend({

        tagName: 'ul',

        className: 'phpdebugbar-widgets-timeline',

        render: function() {
            this.bindAttr('data', function(data) {
                this.$el.empty();
                if (data.measures) {
                    for (var i = 0; i < data.measures.length; i++) {
                        var li = $('<li class="measure" />');
                        li.append($('<span class="label" />').text(data.measures[i].label + " (" + data.measures[i].duration_str + ")"));
                        li.append($('<span class="value" />').css({
                            left: Math.round(data.measures[i].relative_start * 100 / data.duration) + "%",
                            width: Math.round(data.measures[i].duration * 100 / data.duration) + "%"
                        }));
                        this.$el.append(li);
                    }
                }
            });
        }

    });

    // ------------------------------------------------------------------
    
    /**
     * Widget for the displaying exceptions
     *
     * Options:
     *  - data
     */
    var ExceptionsWidget = PhpDebugBar.Widgets.ExceptionsWidget = PhpDebugBar.Widget.extend({

        className: 'phpdebugbar-widgets-exceptions',

        render: function() {
            this.$list = new ListWidget({ itemRenderer: function(li, e) {
                $('<span class="message" />').text(e.message).appendTo(li);
                $('<span class="filename" />').text(e.file + "#" + e.line).appendTo(li);
                $('<span class="type" />').text(e.type).appendTo(li);
                var file = $('<div class="file" />').html(htmlize(e.surrounding_lines.join(""))).appendTo(li);

                li.click(function() {
                    if (file.is(':visible')) {
                        file.hide();
                    } else {
                        file.show();
                    }
                });
            }});
            this.$list.$el.appendTo(this.$el);

            this.bindAttr('data', function(data) {
                this.$list.set('data', data);
                if (data.length == 1) {
                    this.$list.$el.children().first().find('.file').show();
                }
            });

        }

    });

    // ------------------------------------------------------------------
    
    /**
     * Widget for the displaying sql queries
     *
     * Options:
     *  - data
     */
    var SQLQueriesWidget = PhpDebugBar.Widgets.SQLQueriesWidget = PhpDebugBar.Widget.extend({

        className: 'phpdebugbar-widgets-sqlqueries',

        render: function() {
            this.$status = $('<div class="status" />').appendTo(this.$el);

            this.$list = new ListWidget({ itemRenderer: function(li, stmt) {
                $('<span class="sql" />').text(stmt.sql).appendTo(li);
                $('<span class="duration" title="Duration" />').text(stmt.duration_str).appendTo(li);
                $('<span class="memory" title="Peak memory usage" />').text(stmt.memory_str).appendTo(li);
                if (!stmt.is_success) {
                    li.addClass('error');
                    li.append($('<span class="error" />').text("[" + stmt.error_code + "] " + stmt.error_message));
                } else if (typeof(stmt.row_count) != 'undefined') {
                    $('<span class="row-count" title="Row count" />').text(stmt.row_count).appendTo(li);
                }
                if (typeof(stmt.stmt_id) != 'undefined' && stmt.stmt_id) {
                    $('<span class="stmt-id" title="Prepared statement ID" />').text(stmt.stmt_id).appendTo(li);
                }
            }});
            this.$list.$el.appendTo(this.$el);

            this.bindAttr('data', function(data) {
                this.$list.set('data', data.statements);
                this.$status.empty()
                    .append($('<span />').text(data.nb_statements + " statements were executed" + (data.nb_failed_statements > 0 ? (", " + data.nb_failed_statements + " of which failed") : "")))
                    .append($('<span class="duration" title="Accumulated duration" />').text(data.accumulated_duration_str))
                    .append($('<span class="memory" title="Peak memory usage" />').text(data.peak_memory_usage_str));
            });
        }

    });

    // ------------------------------------------------------------------
    
    /**
     * Widget for the displaying templates data
     *
     * Options:
     *  - data
     */
    var TemplatesWidget = PhpDebugBar.Widgets.TemplatesWidget = PhpDebugBar.Widget.extend({

        className: 'phpdebugbar-widgets-templates',

        render: function() {
            this.$status = $('<div class="status" />').appendTo(this.$el);

            this.$list = new ListWidget({ itemRenderer: function(li, tpl) {
                $('<span class="name" />').text(tpl.name).appendTo(li);
                $('<span class="render_time" title="Render time" />').text(tpl.render_time_str).appendTo(li);
            }});
            this.$list.$el.appendTo(this.$el);

            this.bindAttr('data', function(data) {
                this.$list.set('data', data.templates);
                this.$status.empty()
                    .append($('<span />').text(data.templates.length + " templates were rendered"))
                    .append($('<span class="render_time" title="Accumulated render time" />').text(data.accumulated_render_time_str));
            });
        }

    });

})(jQuery);