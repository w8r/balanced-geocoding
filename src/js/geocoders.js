(function() {

    /***************************************************************************
     * Virtual geocoder to test the workflow
     **************************************************************************/
    var Geocoder = function() {};

    Geocoder.prototype = {

        timeout : 2000,

        /**
         * Throttled geocode method
         * 
         * @param {String}
         *            query
         * @param {Funtion}
         *            success
         * @param {Function}
         *            error
         * @returns {Boolean} Whether the geocoder was able to take request or
         *          not
         */
        geocode : function(query, success, error) {
            if (this.busy) {
                return false;
            } else {
                this._geocode(query, success, error);
                this.busy = true;
                _.delay(_.bind(function() {
                                    delete this.busy;
                                }, this), this.timeout);
            }
        },

        /**
         * Actual request
         */
        _geocode : function(query, success, error) {}
    };

    /***************************************************************************
     * Mockup geocoder
     **************************************************************************/
    var MockupGeocoder = function() {};

    MockupGeocoder.prototype = new Geocoder();
    MockupGeocoder.prototype.results = [1, 1, 1, 1, 0, 1, 1, 0, 1, 1];
    MockupGeocoder.prototype._geocode = function(query, success, error) {
        setTimeout(_.bind(function() {
                            var result = this.results.pop();
                            this.results.unshift(result);
                            console
                                    .log('Mockup geocoder resolved with',
                                            result ? 'success' : 'error',
                                            'for', query);
                            if (result) {
                                success(55.3, 22.4);
                            } else {
                                error(result);
                            }
                        }, this), this.timeout);
    };

    /***************************************************************************
     * Google geocoder wrapper
     **************************************************************************/
    var GoogleGeocoder = function() {
        this.service = new google.maps.Geocoder();
    };
    GoogleGeocoder.prototype = new Geocoder();
    GoogleGeocoder.prototype._geocode = function(query, success, error) {
        this.service.geocode({
                    address : query,
                    region : 'ru'
                }, function(results, status) {
                    if (status == google.maps.GeocoderStatus.OK) {
                        // console.log('got from google', arguments);
                        var location = results[0].geometry.location;
                        success(location.lat(), location.lng());
                    } else {
                        error("Geocode was not successful for the following reason: "
                                + status);
                    }
                });
    };

    /***************************************************************************
     * Yandex geocoder
     **************************************************************************/
    var YandexGeocoder = function() {};
    YandexGeocoder.prototype = new Geocoder();
    YandexGeocoder.prototype._geocode = function(query, success, error) {
        this.promise = ymaps.geocode(query);
        this.promise.then(function(res) {
                    // console .log('got from yandex', arguments);
                    var coords =
                            res.geoObjects.get(0).geometry.getCoordinates();
                    success(coords[0], coords[1])
                }, error);
    };

    this.Geocoder = {
        Mockup : MockupGeocoder,
        Google : GoogleGeocoder,
        Yandex : YandexGeocoder
    };
})();
