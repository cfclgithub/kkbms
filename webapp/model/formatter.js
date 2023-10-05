sap.ui.define([], function () {
    "use strict";

    return {

        /**
         * Rounds the number unit value to 2 digits
         * @public
         * @param {string} sValue the number string to be rounded
         * @returns {string} sValue with 2 digits rounded
         */
        numberUnit: function (sValue) {
            if (!sValue) {
                return "";
            }
            return parseFloat(sValue).toFixed(2);
        },
        formatDate: function (dateString) {
            if (dateString) {
                var reg = /^\d*[/]\d*[/]\d*$/;
                if (dateString === "UNCONFIRMED") {
                    return dateString;
                } else if (!dateString) {
                    return "N/A"
                } else if (isNaN(new Date(dateString).getDate())) {
                    return dateString;
                } else if (dateString.match(reg)) {
                    return dateString;
                } else {
                    var localDate = new Date(dateString);
                    var dateFormat;
                    dateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                        pattern: "dd/MM/yyyy"
                    });
                }
                var dateFormatted = dateFormat.format(localDate);

                return dateFormatted;
            } else {
                return "";
            }
        },
        formatAmount: function (sValue) {
            if (sValue) {
              return  new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                    currency: "INR",
                }).format(sValue || 0).replace(/^(\D+)/, '$1 ')
            }
        }

    };

});