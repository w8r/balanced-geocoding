(function() {

    /***************************************************************************
     * Reader
     **************************************************************************/
    var Reader = function() {
        this.reader = new FileReader();
    };

    Reader.prototype = {

        constructor : Reader,

        encoding : 'utf-8', // 'iso-8859-5',

        /**
         * Parses raw file from input
         * 
         * @param {File}
         *            file
         * @param {Function}
         *            callback
         */
        parseRaw : function(file, callback) {
            this.reader.onloadend = function(evt) {
                if (evt.target.readyState == FileReader.DONE) { // DONE == 2
                    callback(evt.target.result);
                }
            };
            // console.log('read @', this.encoding);
            this.reader.readAsText(file, this.encoding);
        }
    };

    /***************************************************************************
     * App
     **************************************************************************/

    var App = function() {
        this.parser = new Reader();

        this.parseTrigger = document.getElementById('parse-csv');
        this.geocodingTrigger = document.getElementById('geocoding');

        this.progressBar = document.getElementById('progress-bar');
        this.prefix = document.getElementById('prefix');

        this.input = document.getElementById('file');
        this.output = document.getElementById('file-contents');
        this.resultOutput = document.getElementById('result');

        this.bindEvents();
    };

    App.prototype = {

        constructor : App,

        /**
         * Don't poll too often
         * 
         * @type Number
         */
        requestInterval : 1000,

        /**
         * API request timeout, play with it at your own risk
         * 
         * @type Number
         */
        apiTimeout : 2000,

        attemptsPerRecord : 3,

        /**
         * Adds DOM events
         */
        bindEvents : function() {
            $(this.parseTrigger).on('click', _.bind(this.handleFile, this));
            $(this.geocodingTrigger)
                    .on('click', _.bind(this.geocodeData, this));
        },

        /**
         * Gets file from file input
         */
        handleFile : function() {
            $('.container-narrow').addClass('no-file');
            var file = this.input.files;
            if (file.length !== 0) {
                file = file[0];
                this.parser.parseRaw(file, _.bind(this.handleData, this));
            }
        },

        /**
         * Handles file contents
         * 
         * @param {String}
         *            contents
         */
        handleData : function(contents) {
            var data = this.data = CSVParser.CSVToArray(contents);
            for (var i = 0, len = data.length; i < len; i++) {
                var row = data[i];
                row.uuid = i;
                row.attempts = +this.attemptsPerRecord;
                [].splice.apply(row, [0, 0].concat((i === 0) ? ['Lat', 'Lng']
                                : ['', '']));
            }

            this.renderCSVdata(data);
            $(this.geocodingTrigger).removeClass('hide');
        },

        /**
         * Renders table with address values
         * 
         * @param {Array}
         *            data
         */
        renderCSVdata : function(data) {
            var html = '';
            for (var i = 0, ii = data.length; i < ii; i++) {
                var cellOpenTag = '<td>',
                    cellCloseTag = '</td>',
                    preWrap = '',
                    postWrap = '';
                if (i === 0) {
                    html += '<thead class="form-inline">';
                    cellOpenTag = '<th>';
                    cellCloseTag = '</label></th>';
                    preWrap =
                            '<label for="col-%" class="checkbox"><input type="checkbox" id="col-%" class="to-address"/> ';
                    postWrap = '</label>'
                }

                var row = data[i], cell;
                html += '<tr id="row-' + row.uuid + '">';
                for (var j = 0, jj = row.length; j < jj; j++) {
                    if (j < 2) {
                        html += cellOpenTag + row[j] + cellCloseTag;
                    } else {
                        html +=
                                cellOpenTag + preWrap.replace(/\%/g, j)
                                        + row[j] + postWrap + cellCloseTag;
                    }
                }

                html += '</tr>';
                if (i === 0) {
                    html += '</thead><tbody>';
                }
            }
            html += '</tbody>';
            this.output.innerHTML = html;
            $('.container-narrow').removeClass('no-file');
        },

        getAddressCols : function() {
            var checked = [];
            _.each($('.to-address'), function(cb) {
                        if (cb.checked) {
                            checked.push(parseInt(cb.id.match(/\d+$/)[0]));
                        }
                    });
            return checked.sort(function(a, b) {
                        return a > b;
                    });
        },

        /**
         * Launches geocoding process
         */
        geocodeData : function() {
            // console.log('start geocoding');
            if (!this.data || this.data.length < 1) {
                alert('No data to work with');
                return;
            }
            var addressFields = this.getAddressCols(),
                prefix = this.prefix.value;
            if (addressFields.length === 0) {
                alert('No columns selected to get address from');
                return;
            }
            this.processedData = [];

            // prepare view
            $('.progress-block').removeClass('hide');
            this.progressBar.style.width = '0%';
            this.resultOutput.setAttribute('rows', 2);
            this.resultOutput.value = '';

            this.geocodersArray =
                    /* [new Geocoder.Mockup(), new Geocoder.Mockup()]; */
                    [new Geocoder.Google(), new Geocoder.Yandex()];

            // it's for header
            this.data[0].resolved = true;
            this.requesting = setInterval(_.bind(function() {
                // filter unresolved
                var row = _.find(this.data, function(record) {
                            return !record.resolved && !record.taken;
                        });
                if (row && (this.data.length - 1 > this.processedData.length)) {
                    // console.log('Row', unresolved);
                    var percentage =
                            (this.processedData.length + 1)
                                    / (this.data.length) * 100,
                        // get address
                        address = _.map(addressFields, function(index) {
                                    return row[index];
                                }).join(' ');
                    address = prefix + ' ' + address;

                    this.progressBar.style.width = percentage + '%';
                    // console.log('geocode', address);
                    // get geocoder
                    var error = _.bind(function() {
                                // could be resolved by concurrent
                                if (row.resolved) {
                                    return;
                                }
                                var tableRow = $('#row-' + row.uuid);
                                tableRow.removeClass('success')
                                        .addClass('error');
                                if (row.attempts === 0) {
                                    row.resolved = true;
                                    if (this.processedData.indexOf(row) === -1) {
                                        this.processedData.push(row);
                                    }
                                } else {
                                    row.attempts--;
                                }
                                this.data[row.uuid] = row;
                                this.data[row.uuid].taken = false;
                            }, this);
                    var success = _.bind(function(lat, lng) {
                                // console.log('Success', lat, lng);
                                row.splice(0, 2);
                                row.push(lat, lng);
                                var tableRow = $('#row-' + row.uuid),
                                    cells = tableRow.find('td');
                                // print values
                                cells[0].innerHTML = lat;
                                cells[1].innerHTML = lng;

                                tableRow.removeClass('error')
                                        .addClass('success');
                                // stripe green
                                row.resolved = true;
                                this.data[row.uuid].taken = false;
                                this.data[row.uuid] = row;
                                if (this.processedData.indexOf(row) === -1) {
                                    this.processedData.push(row);
                                }
                            }, this);

                    // try subsequently
                    if (!this.data[row.uuid].taken) {
                        var taken =
                                this.geocodersArray[0].geocode(address,
                                        success, error);
                        if (!taken) {
                            taken =
                                    this.geocodersArray[1].geocode(address,
                                            success, error);
                        }
                        this.data[row.uuid].taken = taken;
                    }
                    // swap them anyway
                    this.geocodersArray.reverse();
                } else {
                    clearInterval(this.requesting);
                    this.progressBar.style.width = '100%';
                    this.exportData();
                }
            }, this), this.requestInterval);
        },

        /**
         * Export data to CSV
         */
        exportData : function() {
            // lat lng headers to the end
            this.data[0].push(this.data[0].shift());
            this.data[0].push(this.data[0].shift());

            // fill struct
            var struct = new CSV(this.data[0]);
            for (var i = 1, len = this.data.length; i < len; i++) {
                struct.push(this.data[i]);
            }

            // expand textarea
            this.resultOutput.setAttribute('rows', this.data.length);
            this.resultOutput.value = struct.render();

            // select contents
            this.resultOutput.focus();
            this.resultOutput.select();
        }

    };

    this.App = App;

})();
