(function($) {

    var apiKey = "b6be09d6-2ce9-4fe9-9938-c80dc49b9d0b";
    /*
    var endpoint = "http://bustime.mta.info/api/siri/stop-monitoring.json";
     

    var Bus = function(elem) {
        this.$el = $(elem);
        this.$el.on('click', this.flip);
    }

    Bus.prototype.flip = function(e) {
        $(this).toggleClass('flipped');
    }

    var busOne = new Bus($('.left .bus'));
    var busTwo = new Bus($('.right .bus'));

    var storeFormData = function(e) {

        e.preventDefault();

        var stopId = $(this).find('.stop-id').val();
        var lineId = $(this).find('.line-id').val();

        store('stop-id', stopId);
        store('line-id', lineId);

        showDisplay();

        beginPolling(stopId, lineId);
    };

    var promptForIds = function() {
        $('form').addClass('show');
        $('form').on('submit', storeFormData);
    };

    var makeReq = function(stopId, lineId, dir) {
        var data = {
            key: apiKey,
            LineRef: lineId,
            MonitoringRef: stopId,
        };
        return $.ajax({
            url: endpoint,
            data: data,
            dataType: 'jsonp'
        });
    }

    var showDisplay = function() {
        $('.display').addClass('show');
        $('form').removeClass('show');
    }

    var getDistancesFromResult = function(result) {
        return result.Siri
                    .ServiceDelivery
                    .StopMonitoringDelivery[0]
                    .MonitoredStopVisit[0]
                    .MonitoredVehicleJourney
                    .MonitoredCall
                    .Extensions
                    .Distances;
    }

    var getDirectionsFromResult = function(result) {

        var stopvisits = result.Siri
                    .ServiceDelivery
                    .StopMonitoringDelivery[0]
                    .MonitoredStopVisit

        $.each(stopvisits, function() {
            var journey = this.MonitoredVehicleJourney;
            console.log(journey.DestinationName, journey.DirectionRef);
        });

    }

    var updateDisplay = function(result0, result1) {
        console.log(result0[0]);
        console.log(result1[0]);

        var distances0 = getDistancesFromResult(result0[0]);
        var distances1 = getDistancesFromResult(result1[0]);

        getDirectionsFromResult(result0[0]);
        getDirectionsFromResult(result1[0]);

        var presentable = distances.PresentableDistance;
        var stopsAway = distances.StopsFromCall;

        $('#msg').text(presentable);
        $('#stops-away').text(stopsAway + " stops away");
    }

    var beginPolling = function(stopId, lineId) {

        var dir0 = makeReq(stopId, lineId, 0);
        var dir1 = makeReq(stopId, lineId, 1);
        $.when(dir0, dir1).done(updateDisplay);

        setInterval(function() {
            var dir0 = makeReq(stopId, lineId, 0);
            var dir1 = makeReq(stopId, lineId, 1);
            $.when(dir0, dir1).done(updateDisplay);
        }, 10 * 1000);

    }

    var getFromStorage = function(key) {
        return JSON.parse(window.localStorage[key] || false);
    };


    var stopId = getFromStorage('stop-id');
    var lineId = getFromStorage('line-id');

    if (!stopId || !lineId) {
        promptForIds();
    } 

    if (stopId && lineId) {
        showDisplay();
        beginPolling(stopId, lineId);
    }

    */

    var Config = Backbone.Model.extend({
        defaults: { stop: null, route: null },
    });

    var Route = Backbone.Model;
    var Distances = Backbone.Model;
    var Stop = Backbone.Model;

    var Display = Backbone.Model.extend({
        defaults: {
            config: null,
            distances: null
        },
        start: function() {

            var req = this.makeRequest();
            req.done(_.bind(this.update, this));

            setInterval(_.bind(function() {

                var req = this.makeRequest();
                req.done(_.bind(this.update, this));

            }, this), 10 * 1000);

        },

        makeRequest: function() {
            var config = this.get('config');
            var url = 'http://bustime.mta.info/api/siri/stop-monitoring.json';
            var data = {
                key: apiKey,
                LineRef: config.get('route').get('id'),
                MonitoringRef: config.get('stop').get('id')
            };
            var req = $.ajax({
                url: url,
                dataType: 'jsonp',
                data: data,
            });
            return req;
        },

        update: function(result) {
         var distances = result.Siri
                        .ServiceDelivery
                        .StopMonitoringDelivery[0]
                        .MonitoredStopVisit[0]
                        .MonitoredVehicleJourney
                        .MonitoredCall
                        .Extensions
                        .Distances;
            this.set('distances', new Distances(distances));
            console.log(this.get('distances'));
        }
    });

    var DisplayView = Backbone.View.extend({
        tagName: 'div',
        className: 'display',
        events: {
            'click img': 'flipImage'
        },

        template: _.template($('#display-tpl').html()),

        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
        },

        render: function() {
            console.log('render', 
                this.model.get('config').get('stop'), 
                this.model.get('config').get('route')
            );

            this.$el.html(this.template(this.model.toJSON()));
        },

        flipImage: function(e) {
            $(e.currentTarget).toggleClass('flipped');
        }
    });

    var store = function(key, val) {
        window.localStorage[key] = JSON.stringify(val);
        return val;
    }

    var get = function(key) {
        try {
            return JSON.parse(window.localStorage[key]);
        } catch (e) {
            return {};
        }
    }

    var ConfigForm = Backbone.View.extend({

        template: _.template($('#form-tpl').html()),
        stopTemplate: _.template($('#stop-tpl').html()),

        initialize: function() {
            this.listenTo(this.model, 'change', this.render);
        },

        render: function() {
            console.log('rendering', this.model.toJSON());
            this.$el.html(this.template(this.model.toJSON()));
        },

        events: {
            'keyup .line-id input': 'checkBusRoute',
            'keyup .stop-id input': 'checkStop',
            'click .line-id button': 'useBusRoute',
            'click #stop-results li': 'useStop',
            'click .start': 'save',
            'click .clear': 'clear'
        },

        checkBusRoute: function(e) {
            var route = searchRoutes(e.target.value)
            var button = this.$el.find('.line-id button')

            if (route) {
                this.route = route;
                button.removeClass('disabled');
            } else {
                this.route = null;
                button.addClass('disabled');
            }

        },

        checkStop: function(e) {
            var stops = searchStops(e.target.value)
            var button = this.$el.find('.stop-id button')

            var resultsList = this.$el.find('#stop-results');
            resultsList.empty();

            if (stops) {
                _.each(stops, function(stop) {
                    resultsList.append(this.stopTemplate(stop));
                }, this);
            } 

        },

        useBusRoute: function(e) {
            e.preventDefault();

            if ($(e.currentTarget).hasClass('.disabled')) {
                return;
            }

            this.model.set('route', new Route(this.route));
        },

        useStop: function(e) {
            e.preventDefault();
            var code = $(e.currentTarget).data('stop-id');
            var stop = searchStopsByCode(code);
            console.log('found stop', stop);
            this.model.set('stop', new Stop(stop));
        },

        getVal: function(sel) {
            return this.$el.find(sel).val();
        },

        save: function(e) {
            e.preventDefault();
            store('config', this.model.toJSON());
            this.trigger('save');
        },

        clear: function(e) {

            e.preventDefault();
            e.stopPropagation();

            store('config', '');

            this.model.set({
                'route': null, 
                'stop': null
            });
        }

    });

    var storedData = get('config');

    var config = new Config();
    if (storedData.route && storedData.stop) {
        config.set('route', new Route(storedData.route));
        config.set('stop', new Route(storedData.stop));
    }

    var configForm = new ConfigForm({
        el: '.setup form',
        model: config
    });

    configForm.render()

    configForm.on('save', function(view) {
        $('.setup').addClass('gone');
        $('.displays').removeClass('gone');

        var display = new Display({ config: config });
        var displayView = new DisplayView({
            model: display
        })
        display.start();

        displayView.render();
        $('.displays').append(displayView.el);
    });

    config.on('change:route', function(config) {

        if (!config.get('route')) {
            return;
        } 

        url = "http://bustime.mta.info/api/where/stops-for-route/" + config.get('route').get('id') + ".json"
        data = { 
            key: apiKey 
        };
        var req = $.ajax({
            url: url,
            data: data,
            dataType: 'jsonp'
        });
        req.done(function(results) {
            window.stops = results.data.stops;
        });
    });

    var routesUrl = "http://bustime.mta.info/api/where/routes-for-agency/MTA%20NYCT.json";
    var data = { key: apiKey };

    var req = $.ajax({
        url: routesUrl,
        data: data,
        dataType: 'jsonp'
    });

    window.searchRoutes;

    window.searchStops = function(str) {
        if (!window.stops) {
            return;
        }

        str = str.toLowerCase();

        return _.filter(stops, function(stop) {
            return stop.name.toLowerCase().indexOf(str) !== -1;
        });
    };

    window.searchStopsByCode = function(code) {
        if (!window.stops) {
            return;
        }

        return (_.filter(stops, function(stop) {
            return stop.code == code;
        }))[0];
    }

    var indexRoutes = function(routes) {
        var index = {};

        _.each(routes, function(route) {
            var key = route.shortName.toLowerCase();
            index[key] = route
        });

        return index;
    }

    req.done(function (result) {
        var indexedRoutes = indexRoutes(result.data.list);

        searchRoutes = function(str) {
            var search = str.toLowerCase();
            if (indexedRoutes.hasOwnProperty(search)) {
                return indexedRoutes[search];
            }
        }

    });
    
})(window.jQuery)

