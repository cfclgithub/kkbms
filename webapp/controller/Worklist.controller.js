sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel",
	"../model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	'sap/m/SearchField',
	'sap/ui/table/Column',
	'sap/m/Column',
	'sap/m/MessageBox',
	"sap/ui/export/Spreadsheet",
	"sap/ui/core/Fragment",
	"sap/ui/core/syncStyleClass",
	'sap/m/Token'
], function (BaseController, JSONModel, formatter, Filter, FilterOperator, SearchField, UIColumn, Column, MessageBox, Spreadsheet, Fragment, syncStyleClass, Token) {
	"use strict";

	return BaseController.extend("com.cfcl.comparativeanalysisui.controller.Worklist", {

		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function () {
			var oViewModel;

			// keeps the search state
			this._aTableSearchState = [];

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				shareSendEmailSubject: this.getResourceBundle().getText("shareSendEmailWorklistSubject"),
				shareSendEmailMessage: this.getResourceBundle().getText("shareSendEmailWorklistMessage", [location.href]),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				Ebln: ""
			});
			this.setModel(oViewModel, "worklistView");
			var nfaModel = new JSONModel();
			this.getView().setModel(nfaModel, "nfaModel");
			this.selectedEvents = [];
			// this.readBackendData();
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function (oEvent) {
			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("worklistTableTitle");
			}
			this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onPress: function (oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler for navigating back.
		 * Navigate back in the browser history
		 * @public
		 */
		onNavBack: function () {
			// eslint-disable-next-line sap-no-history-manipulation
			history.go(-1);
		},


		onSearch: function (oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any main list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
			} else {
				var aTableSearchState = [];
				var sQuery = oEvent.getParameter("query");

				if (sQuery && sQuery.length > 0) {
					aTableSearchState = [new Filter("Ebeln", FilterOperator.Contains, sQuery)];
				}
				this._applySearch(aTableSearchState);
			}

		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function () {
			var oTable = this.byId("table");
			oTable.getBinding("items").refresh();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function (oItem) {
			this.getRouter().navTo("object", {
				objectId: oItem.getBindingContext().getPath().substring("/RFQList".length)
			});
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {sap.ui.model.Filter[]} aTableSearchState An array of filters for the search
		 * @private
		 */
		_applySearch: function (aTableSearchState) {
			var oTable = this.byId("table"),
				oViewModel = this.getModel("worklistView");
			oTable.getBinding("items").filter(aTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (aTableSearchState.length !== 0) {
				oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
			}
		},
		onValueHelpRequestedEvent: function (oEvent) {
			var rfqNumField = this.byId("idInputRFQNumber");
			if (!rfqNumField.getValue()) {
				sap.m.MessageBox.error("Please select the RFQ Number First");
				rfqNumField.setValueState("Error");
				return;
			} else {
				rfqNumField.setValueState("None");
			}
			var oButton = oEvent.getSource(),
				oView = this.getView();

			if (!this._eventDialog) {
				this._eventDialog = Fragment.load({
					id: oView.getId(),
					name: "com.cfcl.comparativeanalysisui.view.fragments.multiSelectEvents",
					controller: this
				}).then(function (oDialog) {
					oView.addDependent(oDialog);
					return oDialog;
				});
			}
			this._eventDialog.then(function (oDialog) {
				oDialog.setMultiSelect(false);
				let aFilters = [];
				aFilters.push(new Filter({
					filters: [
						new Filter({ path: "Ebeln_Ebeln", operator: 'EQ', value1: this.byId("idInputRFQNumber").getValue() }),
						new Filter({ path: "status", operator: 'NE', value1: 'Draft' })
					],
					and: true
				}));
				if (!this.eventTemplate) {
					this.eventTemplate = oDialog.getItems()[0].clone();
				}
				oDialog.bindAggregation("items", {
					path: "/RFQEvents",
					filters: aFilters,
					template: this.eventTemplate
				});
				oDialog.open();
			}.bind(this));

		},
		onValueHelpCancelPressEvent: function () {
			if (this._oVHDEvent) {
				this._oVHDEvent.close();
			}
		},
		onValueHelpOkPressEvent: function (oEvent) {
			var aTokens = oEvent.getParameter("tokens");
			this.getView().byId("idInputEvent").setTokens(aTokens);
			let selectedIndices = oEvent.getSource().getTable().getSelectedIndices();
			for (let i of selectedIndices) {
				let selectedEventsData = oEvent.getSource().getTable().getContextByIndex(i).getObject();
				this.selectedEvents.push(selectedEventsData);
			}
			//Sort aEvents based on creation date
			this.selectedEvents.sort(function (a, b) {
				return new Date(b.createDate) - new Date(a.createDate);
			});
			this.nfaEvent = this.selectedEvents[0].internalId;
			this._oVHDEvent.close();
		},
		onFilterBarEventSearch: function (oEvent) {
			var sSearchQuery = this._oBasicSearchField.getValue(),
				aSelectionSet = oEvent.getParameter("selectionSet");
			if (aSelectionSet) {
				var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
					if (oControl.getValue()) {
						aResult.push(
							new Filter({
								path: oControl.getName(),
								operator: FilterOperator.Contains,
								value1: oControl.getValue(),
							})
						);
					}
					return aResult;
				}, []);
			} else {
				var aFilters = [];
			}
			let searchFilters = new Filter({
				filters: [
					new Filter({
						path: "internalId",
						operator: FilterOperator.Contains,
						value1: sSearchQuery,
					}),
					new Filter({
						path: "title",
						operator: FilterOperator.Contains,
						value1: sSearchQuery,
					}),
					new Filter({
						path: "status",
						operator: FilterOperator.Contains,
						value1: sSearchQuery,
					}),
				],
				and: false,
			});

			let defaultFilter = new Filter({
				filters: [
					new Filter({ path: "Ebeln_Ebeln", operator: "EQ", value1: this.byId("idInputRFQNumber").getValue() })
				],
				and: true,
			});
			let finalFilter = new Filter({ filters: [searchFilters, defaultFilter], and: true });
			aFilters.push(finalFilter)
			this._filterEventTable(
				new Filter({
					filters: [finalFilter],
					and: true,
				})
			);
		},
		_filterEventTable: function (oFilter) {
			var oVHD = this._oVHDEvent;

			oVHD.getTableAsync().then(function (oTable) {
				if (oTable.bindRows) {
					oTable.getBinding("rows").filter(oFilter);
				}
				if (oTable.bindItems) {
					oTable.getBinding("items").filter(oFilter);
				}

				// This method must be called after binding update of the table.
				oVHD.update();
			});
		},
		onGoButtonPress: function (oEvent) {
			var rfqNumber = this.byId("idInputRFQNumber").getValue();
			var data = {
				"rfqNumber": rfqNumber
			}
			console.log("Payload: " + JSON.stringify(data));
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			// var token = this.fetchToken();
			// added by kamal
			let selectedEvents = this.byId("idInputEvent").getTokens();
			for (let i = 0; i < selectedEvents.length; i++) {
				data.eventId = data.eventId ? data.eventId + "," + selectedEvents[i].getKey() : selectedEvents[i].getKey();
			}
			// end of code by kamal
			var settings = {
				async: true,
				url: appModulePath + "/comparative-analysis/getEventItems",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (response) {
					this.getView().setBusy(false);
					var result = response.value;
					var array = result;
					var no_of_rows = result[0].DataSet;
					let row_array = [];
					no_of_rows.forEach(function (entry1, j) {
						var obj = {};
						var j_value = j;
						array.forEach(function (entry, i) {
							var field = result[i].DataSet[j_value];
							var fieldvalue = field.value;
							// var name = result[i].description;
							var name = field.name.toString();
							Object.defineProperty(obj, name, {
								value: fieldvalue //set data1 and data 2 accordingly
							});
						}.bind(this));
						row_array.push(obj);
					}.bind(this));
					var sJSONModel = new sap.ui.model.json.JSONModel();
					this.getView().setModel(sJSONModel, "sJSONModel");
					let bFlag = false;
					// row_array.forEach(function (obj) {
					// 	if (!bFlag && obj.colA === "--" && obj.colB === "--" && obj.colB === "--") {
					// 		bFlag = true;
					// 	} else if (bFlag) {
					// 		for (var k in obj) {
					// 			obj[k] = "<b> " + obj[k] + "</b>";
					// 		};
					// 		bFlag = false;
					// 	}
					// });
					sJSONModel.setData({
						rows: row_array,
						columns: result
					});
					var oTable = this.byId("idUITable");
					oTable.setModel(sJSONModel);
					oTable.bindColumns("/columns", function (sId, oContext, index) {
						var name = oContext.getObject().name;
						var columnName = oContext.getObject().description;
						return new sap.ui.table.Column({
							label: new sap.m.Label({
								text: columnName,
								wrapping: true
							}),
							template: name,
							sortProperty: name,
							width: columnName.toUpperCase() === 'CUR' ? '4rem' : '15rem',
							filterProperty: name,
							hAlign: oContext.getObject().position >= 4 ? 'Right' : 'Center'
						});
					});
					oTable.bindRows("/rows");
					// this.byId("idLineItemTable").setVisible(true);
					// this.onRowsUpdated(oTable);
				}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					MessageBox.error("error:" + error.message);
				}.bind(this));
			this.readNFADetails(rfqNumber, data.eventId);
			this.readRewaredDevendors(rfqNumber, data.eventId);
			this.readnonQoutedDendors(rfqNumber, data.eventId);
		},
		_handlePresstemplate: function () {
			var fragId = this.createId("idTemplate");
			if (!this.templateFragment) {
				this.templateFragment = this._createFragment(fragId, "com.cfcl.comparativeanalysisui.view.fragments.template");
				this.getView().addDependent(this.templateFragment);
			}
			// this.updateFiltersForSavingPlanOvewview(fragId);
			this.templateFragment.open();
		},
		_createFragment: function (sFragmentID, sFragmentName) {
			var oFragment = sap.ui.xmlfragment(sFragmentID, sFragmentName, this);
			return oFragment;
		},
		handleClose: function () {
			if (this.templateFragment) {
				this.templateFragment.close();
			}
		},
		onPrintPress: function () {
			// let sPromise = new Promise(function (resolve, reject) {
			// 	this._getDepartment(resolve, reject);
			// }.bind(this));
			// sPromise.then(function (data) {
			// 	this.printDocument(data.value);
			// }.bind(this))
			this.printDocument();
		},
		_getDepartment: function (resolve, reject) {
			var eventId = this.byId("idInputEvent").getValue();
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			// var token = this.fetchToken();
			var data = {
				"eventId": eventId
			}
			console.log("Payload: " + JSON.stringify(data));
			var settings = {
				async: true,
				url: appModulePath + "/comparative-analysis/getDepartment",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(
					function (response) {
						this.getView().setBusy(false);
						// sap.m.MessageToast.show("Data Retrieved");
						if (resolve) {
							resolve(response);
						}
					}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					MessageBox.error("error:" + error.message);
					if (reject) {
						reject();
					}
				}.bind(this));
		},
		printDocument: function (dept) {
			if (!dept) {
				dept = this.dept;
			}
			var sText = "", src;
			if (this.dept === "KKBMS") {
				sText = "KK BIRLA MEMORIAL SOCIETY";
				src = "";
			} else {
				sText = "CHAMBAL FERTILISERS AND CHEMICALS LIMITED";
				src = "data:image/png;base64,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";
			}
			let data = JSON.parse(JSON.stringify(this.getView().getModel("nfaModel").getProperty("/")));
			const { columns } = this.getView().getModel("sJSONModel").getProperty("/");
			const cellStyle = `border: 0.4pt solid #ccc; padding: 1px; word-wrap:break-word;`;
			const padding = `border: 0.4pt solid #ccc; padding: 5px;`;
			const currencyHeaderStyle = "width: 3%;";
			let nonQoutedVendors = this.getView().getModel("worklistView").getProperty("/nonQoutedVendors");
			if (!nonQoutedVendors) {
				nonQoutedVendors = [];
			}
			nonQoutedVendors.forEach(function (item) {
				var sObj = {};
				sObj.index = item.slno;
				sObj.vendorName = item.vendorName + " <b> (Non Qouted) </b>";
				sObj.totalAmount = item.price;
				data.vendorDetails.push(sObj);
			});
			const getFormattedDate = (dateString) => {
				if (!dateString) return "";
				const dateObj = new Date(dateString)
				if (!dateObj) return "";

				return (dateArr => { [dateArr[0], dateArr[1]] = [dateArr[1], dateArr[0]]; return dateArr.join("/") })(dateObj.toLocaleDateString().split("/"))

			}
			let { columns: vendorColumns } = this.getView().getModel("sJSONModelRewarded").getProperty("/");
			if (!vendorColumns) {
				sap.m.MessageBox.error("Rewarded vendors are not present");
				return;
			}
			const recommendedVendorList = vendorColumns && vendorColumns.length > 1 ? vendorColumns.slice(1).reduce((recVendor, data) => {
				recVendor.push({ name: data.description, description: this.getItemNumb(data.udf1, data.udf2) })
				return recVendor;
			}, []) : [];

			/* html */
			const documentContent = `<div class="invoice-box"
				style="margin: auto;padding: 30px;font-size: 11px;font-family: Arial, sans-serif;line-height: 24px;font-family: &quot;Helvetica Neue&quot;, &quot;Helvetica&quot;, Helvetica, Arial, sans-serif;color: #555;">
				<h1 id="main-heading"
					style="margin-top: 0;font-size: 1.4em;display: flex;justify-content: center;align-items: center;gap: var(--padding-buffer);">
					<img class="logo" src= ${src} alt="Company Logo" style="height: 40px;width: auto;">
					${sText}
				</h1>
				<hr>
				<h3 id="second-heading" style="text-align: center;text-decoration: underline;">Approval Note (${dept})</h3>

				<div class="passage-Box" style="display: flex;flex-direction: column; --border-size: 1px; --padding-buffer: 10px;">
					<table class="table-container" style="border-collapse: collapse;width: 100%;text-align: left;font-size: 11px; font-family: Arial, sans-serif;">
						<tr>
							<th style="${padding}">Enquiry No :</th>
							<td colspan="2" data-field="enquiryNo" style="${padding}">${data.Ebeln}</td>
							<th style="${padding}">Run Date :</th>
							<td colspan="2" data-field="runDate" style="${padding}">${getFormattedDate(data.RunDate)}</td>
						</tr>
						<tr>
							<th style="${padding}">RFQ Date :</th>
							<td data-field="rfqDate" style="${padding}">${getFormattedDate(data.RFQDate)}</td>
							<th style="${padding}">Commercial Bid Opening :</th>
							<td data-field="techBidOpeningDate" style="${padding}">${getFormattedDate(data.TechBidOpening)}</td>
							<th style="${padding}">PR Release Date :</th>
							<td data-field="indentReleaseDate" style="${padding}">${getFormattedDate(data.IndentReleaseDate)}</td>
						</tr>
						<tr>
							<td colspan="6" style="${padding}">
								<b>Subject : </b>
								${data.Subject}
							</td>
						</tr>
					</table>

					<table data-field="vendors" data-dynamic="table" style="border-collapse: collapse;width: 100%;font-size: 11px; font-family: Arial, sans-serif;">
						<thead>
							<tr>
								<th data-col="index" style="${padding};">Sr.No</th>
								<th data-col="vendorName" style="${padding};">Vendors Quoted
								</th>
								<th data-col="finalPrice" style="${padding};">
									Final Evaluated Price with Taxes ₹
								</th>
							</tr>
						</thead>
						<tbody>${data.vendorDetails.reduce(
				(acc, curr, index) =>
				(acc += `<tr>
						${["index", "vendorName", "totalAmount"].reduce(
					(cellAcc, cellField) =>
					(cellAcc += `
						<td title="${curr[cellField]}" style="${padding};${cellField === "totalAmount" ? "text-align: center" : ""}">${cellField === "index" ? (index + 1) : cellField === "totalAmount" ? new Intl.NumberFormat("en-IN", {
						style: "currency",
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
						currency: "INR",
					}).format(curr[cellField] || 0).replace(/^(\D+)/, '$1 ') : curr[cellField]}</td>`),
					""
				)}
				</tr>`),
				""
			)}</tbody>

					</table>
					<div style="padding: 0px var(--padding-buffer);">
					<span><b>Basis : </b></span>
					<span data-field="recommended.basis">${data.Basis}</span>
						</div>
					<div class="second-section"
						style="height: 100%; border: 0.4pt solid #ccc;border-bottom: none;">
						<div class="pair-list flex"
							style="display: flex;grid-template-columns: 1fr 1fr;justify-content: space-between;padding: var(--padding-buffer);">
							<div style="display: flex;">
								<span><b>Recommended Vendor :</b> </span>
								<ol style="margin:unset;color: black;">${recommendedVendorList?.reduce((acc, vendor) => acc += `<li>${vendor.name} <span style="margin-left: 1em;">(${vendor.description && this.getView().getModel("nfaModel").getProperty("/udf2") !== "service" ? "for item " + vendor.description.replace(/^0+/, '') : vendor.description})</span></li>`, "")}
							</div>
							
						</div>

						<div style="padding: 0px var(--padding-buffer);">
						<span><b>Justification</b>:</span>
						<span>${data.Justification}</span>
						</div>

						<div style="padding: 0px var(--padding-buffer);">
						<span><b>Terms of payment</b>:</span>
						<span>${data.TermsofPayment}</span>
						</div>

						<div style="padding: 0px var(--padding-buffer);">
							<span><b>Cost breakup &amp; Commercial Terms: </b></span>
						</div>
					</div>
					
					<div class="third-section">
						<!-- Recommended Vendor Table -->
						<div
							style="display: grid;grid-template-columns: unset;">
							<table id="caTable" style="border: 0.4pt solid #ccc;border-collapse: collapse;table-layout: fixed;width: 100%;font-size: 11px; font-family: Arial, sans-serif;">
								<thead>${`<tr>${vendorColumns?.reduce(
				(acc, curr) => (acc += `<th style="${padding}">${curr.description}</th>`),
				""
			)}</tr>`
				}
								</thead>
								<tbody>
								${vendorColumns[0]?.DataSet?.reduce((accRow, curRow, rowIndex) => {
					return (accRow += `<tr>${vendorColumns.reduce((accCell, curCell, index) => {
						return (accCell += `<td style="${padding} ${index !== 0 ? "text-align:center;" : ""}">${((curCell.DataSet[rowIndex].value === "Net Order Value" || curCell.DataSet[rowIndex].value === "Total Basic Cost(INR)" || curCell.DataSet[rowIndex].value === "Total Basic Cost") ? "<b> " + curCell.DataSet[rowIndex].value + " </b>" : curCell.DataSet[rowIndex].value) || "-"}</td>`);
					}, "")}</tr>`);
				}, "")}
								</tbody>
							</table>
						</div>
						
						<div style="height: 4em;border: 0.4pt solid #ccc;border-top: 0;border-bottom: 0;"></div>

						<table style="border: 1px solid black;border-collapse: collapse;table-layout: fixed;width: 100%;font-size: 11px; font-family: Arial, sans-serif;" >
							<tr>
								<td style="${cellStyle}"><b style="color:#555;">WBS #:</b></td>
								<td style="${cellStyle}">${data.CategoryWBS}</td>
								<td style="${cellStyle}"><b style="color:#555;">WBS Description:</b></td>
							</tr>
							<tr>
								<td style="${cellStyle}"><b style="color:#555;">Budget Amount ₹:</b></td>
								<td style="${cellStyle}">${data.BudgetAmount}</td>
								<td rowspan="2" style="${cellStyle}">${data.WBSDescription}</td>
							</tr>
							<tr>
								<td style="${cellStyle}"><b style="color:#555;">Budget Utilized ₹:</b></td>
								<td style="${cellStyle}">${data.BudgetUtilized}</td>
							</tr>
						</table>
					</div>

					<div class="pair-list flex evenly padded-t-max"
						style="padding: 2em;border: 0.4pt solid #ccc;">
						<h4 class="padded-t" style="margin: unset;padding-top: var(--padding-buffer);">For your kind approval, please.
						</h4>
						<div style="display: flex;gap: 10px;padding-top: var(--padding-buffer);"><h4 style="margin: unset;">Under Chapter of Loam:</h4> ${data.UnderChapterofLoam} </div>
						<div style="display: flex;gap: 10px;padding-top: var(--padding-buffer);"><h4 style="margin: unset;">Approved By:</h4> <span style="color: red;">(Required Name of approving authority with date stamp)</span></div>
					</div>
				</div>

				<div style="margin-top: 3em; page-break-before: always;" />

				<h3 id="second-heading" style="text-align: center;text-decoration: underline;">Comparative Statement</h3>
				<table id="caTable" style="border: 1px solid black;border-collapse: collapse;table-layout: fixed;width: 100%;font-size: 11px; font-family: Arial, sans-serif;">
					<thead>${`<tr>${columns?.reduce(
					(acc, curr) => (acc += `<th style="${curr.description === "Cur" ? cellStyle + currencyHeaderStyle : cellStyle}">${curr.description}</th>`),
					""
				)}</tr>`
				}
					</thead>
					<tbody>
					${columns[0]?.DataSet?.reduce((accRow, curRow, rowIndex) => {
					const splitIndex = columns[0]?.DataSet.findIndex((eachData) => eachData.value === 'line Items ') + 1;

					return (accRow += `<tr  style="${((rowIndex >= splitIndex && (rowIndex - splitIndex) % 6 === 0) || rowIndex === splitIndex - 1) ? "border-top: 2px solid black;" : ""}">${columns.reduce((accCell, curCell) => {
						return (accCell += `<td style="${cellStyle}">${((curCell.DataSet[rowIndex].value === "Net Order Value" || curCell.DataSet[rowIndex].value === "Total Basic Cost(INR)" || curCell.DataSet[rowIndex].value === "Total Basic Cost") ? "<b>" + curCell.DataSet[rowIndex].value + "</b>" : curCell.DataSet[rowIndex].value) || "-"}</td>`);
					}, "")}</tr>`);
				}, "")}
					</tbody>
				</table>
			</div>
			</div>
			`;
			const win = window.open();
			// const style = document.createElement('style');
			// style.textContent = `@page{size: landscape;}`;
			win.document.write(documentContent);
			win.document.title = data.Ebeln + " NFA " + this.dept + " Department";
			// win.document.querySelector("head").appendChild(style);
			// win.print();
			// win.document.write('<style>@page { size: landscape; }</style>');
			win.document.close();
			win.focus();
			win.print();
			// win.close();
			// $(document).ready(function(){ 
			// 	setTimeout(function(){
			// 		win.print();
			// 	  }, 1000);
			//   });
			//win.close();
		},
		readNFADetails: function (rfqNumber, eventId) {
			var data = {
				"rfqNumber": rfqNumber,
				"eventId": eventId
			}
			console.log("Payload: " + JSON.stringify(data));
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			// var token = this.fetchToken();
			var settings = {
				async: true,
				url: appModulePath + "/comparative-analysis/getNfaDetails",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (response) {
					this.getView().setBusy(false);
					if (response.value.length) {
						// response.value[0].Justification  = decodeURIComponent(response.value[0].Justification);
						// response.value[0].TermsofPayment  = decodeURIComponent(response.value[0].TermsofPayment);
						var sCount = 1;
						response.value[0].vendorDetails.forEach(function (item) {
							item.index = sCount
							sCount = sCount + 1;
						});
						response.value[0].RunDate = new Date().toISOString();
						this.getView().getModel("nfaModel").setProperty("/", response.value[0]);
					}

				}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					MessageBox.error("error:" + error.message);
				}.bind(this));
		},
		_handleSavePDFDetails: function () {
			var sData = this.getView().getModel("nfaModel").getProperty("/");
			// var token = this.fetchToken();
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			var sData1 = JSON.parse(JSON.stringify(sData));
			delete sData1.vendorDetails;
			var settings = {
				async: false,
				url: appModulePath + "/comparative-analysis/nfaDetails",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(sData1)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (response) {
					this.getView().setBusy(false);
					MessageBox.success("Data Saved Successfully");
				}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					var errorMessage = error.responseJSON.error.message;
					if (errorMessage.startsWith("Reference integrity is violated for association")) {
						var associatedField = error.responseJSON.error.target.split(".")[1].toLowerCase();
						MessageBox.error("Invalid value for field : " + associatedField);
						throw new Error("");
					} else if (errorMessage.startsWith("Entity already exists")) {
						MessageBox.error("Entity already exists");
						throw new Error("");
					}
					else {
						MessageBox.error(error.responseText);
						return;
					}
				}.bind(this));
		},
		formatAmount: function (svalue) {
			if (svalue) {
				return svalue.toFixed(2);
			}
		},
		readRewaredDevendors: function (rfqNumber, eventId) {
			// this.getView
			var data = {
				"rfqNumber": rfqNumber,
				"eventId": eventId
			}
			var sJSONModelRewarded = new JSONModel();
			this.getView().setModel(sJSONModelRewarded, "sJSONModelRewarded");
			console.log("Payload: " + JSON.stringify(data));
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			// var token = this.fetchToken();
			var settings = {
				async: true,
				url: appModulePath + "/comparative-analysis/getRecomendedVendors",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (response) {
					this.getView().setBusy(false);
					var result = response.value;
					var array = result;
					var no_of_rows = result[0].DataSet;
					let row_array = [];
					if (!no_of_rows) {
						// sap.m.MessageBox.error("Rewarded vendors are not present");
						return;
					}
					no_of_rows.forEach(function (entry1, j) {
						var obj = {};
						var j_value = j;
						array.forEach(function (entry, i) {
							var field = result[i].DataSet[j_value];
							var fieldvalue = field.value;
							// var name = result[i].description;
							var name = field.name;
							Object.defineProperty(obj, name, {
								value: fieldvalue //set data1 and data 2 accordingly
							});
						});
						row_array.push(obj);
					});
					sJSONModelRewarded.setData({
						rows: row_array,
						columns: result
					});
					var oTable = this.byId("idUITableRewaredVendor");
					oTable.setModel(sJSONModelRewarded);
					oTable.bindColumns("/columns", function (sId, oContext) {
						var name = oContext.getObject().name;
						var columnName = oContext.getObject().description;
						return new sap.ui.table.Column({
							label: columnName,
							template: name,
							sortProperty: name,
							filterProperty: name,
							hAlign: oContext.getObject().position >= 2 ? 'Right' : 'Left'
						});
					});
					oTable.bindRows("/rows");
					// this.byId("idLineItemTable").setVisible(true);
				}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					MessageBox.error("error:" + error.message);
				}.bind(this));
		},
		_handlePressSyncRfq: function () {
			let sParams = {};
			sParams.sPath = '/comparative-analysis/updateRFQList';
			sParams.data = {}
			sParams.method = 'POST';

			let nePromise = new Promise(function (resolve, reject) {
				this.callAjax(sParams, resolve, reject);
			}.bind(this));
			nePromise.then(function (data) {
				let sMsg = "Data has been Synced";
				if (data.value) {
					sMsg = data.value;
				}
				sap.m.MessageBox.success(sMsg);
			}.bind(this));
		},
		_handlePressSyncEventItems: function () {
			let sParams = {};
			var rfqNumField = this.byId("idInputRFQNumber");
			if (!rfqNumField.getValue()) {
				sap.m.MessageBox.error("Please select the RFQ Number First");
				rfqNumField.setValueState("Error");
				return;
			} else {
				rfqNumField.setValueState("None");
			}
			let selectedEvents = this.byId("idInputEvent").getTokens(), eventId;
			for (let i = 0; i < selectedEvents.length; i++) {
				eventId = eventId ? eventId + "," + selectedEvents[i].getKey() : selectedEvents[i].getKey();
			}
			var eventNumField = this.byId("idInputEvent");
			if (!eventId) {
				sap.m.MessageBox.error("Please select the Event Number");
				eventNumField.setValueState("Error");
				return;
			} else {
				eventNumField.setValueState("None");
			}
			sParams.sPath = '/comparative-analysis/stageEvents';
			sParams.data = {
				rfq: rfqNumField.getValue()
			}
			sParams.method = 'POST';

			let nePromise = new Promise(function (resolve, reject) {
				this.callAjax(sParams, resolve, reject);
			}.bind(this));

			nePromise.then(function () {
				sParams = {};
				sParams.sPath = '/comparative-analysis/updateRewaredVendors';
				sParams.data = {
					rfqNumber: rfqNumField.getValue(),
					eventId: eventId
				}
				sParams.method = 'POST';
				this.callAjax(sParams);
			}.bind(this));
		},
		callAjax: function (sParams, resolve, reject) {
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			var settings = {
				async: true,
				url: appModulePath + sParams.sPath,
				method: sParams.method,
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(sParams.data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (data) {
					this.getView().setBusy(false);
					if (resolve) {
						resolve(data);
					} else {
						this.onGoButtonPress();
						sap.m.MessageBox.success("Data has been Synced");

					}
				}.bind(this)
				)
				.fail(function (oError) {
					this.getView().setBusy(false);
					if (reject) {
						reject();
					}
					console.log(oError);
					MessageBox.error("1: Error while Sync please try again");
				}.bind(this));
		},
		_handlePressSyncEvents: function () {
			let sParams = {};
			var rfqNumField = this.byId("idInputRFQNumber");
			if (!rfqNumField.getValue()) {
				sap.m.MessageBox.error("Please select the RFQ Number First");
				rfqNumField.setValueState("Error");
				return;
			} else {
				rfqNumField.setValueState("None");
			}
			sParams.sPath = '/comparative-analysis/syncEvents';
			sParams.data = {
				rfq: rfqNumField.getValue()
			}
			sParams.method = 'POST';

			let nePromise = new Promise(function (resolve, reject) {
				this.callAjax(sParams, resolve, reject);
			}.bind(this));

			nePromise.then(function () {
				sap.m.MessageToast.show("Events has been synced");
			}.bind(this));
		},
		readnonQoutedDendors: function (rfqNumber, eventId) {
			// this.getView
			var data = {
				"rfqNumber": rfqNumber,
				"eventId": eventId
			}
			// var sJSONModelRewarded = new JSONModel();
			// this.getView().setModel(sJSONModelRewarded, "sJSONModelRewarded");
			console.log("Payload: " + JSON.stringify(data));
			var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
			var appPath = appId.replaceAll(".", "/");
			var appModulePath = jQuery.sap.getModulePath(appPath);
			// var token = this.fetchToken();
			var settings = {
				async: true,
				url: appModulePath + "/comparative-analysis/getNonQuotedVendors",
				method: "POST",
				headers: {
					"content-type": "application/json"
				},
				processData: false,
				data: JSON.stringify(data)
			};
			this.getView().setBusy(true);
			$.ajax(settings)
				.done(function (response) {
					this.getView().setBusy(false);
					var result = response.value;
					var array = result;
					this.getView().getModel("worklistView").setProperty("/nonQoutedVendors", array)
				}.bind(this)
				)
				.fail(function (error) {
					this.getView().setBusy(false);
					MessageBox.error("error:" + error.message);
				}.bind(this));
		},
		onRowsUpdated: function (oEvent) {
			var oTable = this.byId("idUITable");
			const aRows = oTable.getRows();
			if (aRows.length > 0) {
				aRows.forEach(oRow => {
					var sData = oRow.oBindingContexts.undefined.getObject()
					if (sData.colA === "--" && sData.colB === "--" && sData.colC === "--") {
						oRow.addStyleClass("green");
					}
					else {
						oRow.removeStyleClass("green");
					}
				})
			}
		},
		onExcelExport: function () {
			var expData = this.getView().getModel("sJSONModel").getData().rows;
			if (expData.length > 0) {
				var expCols = [], lbl, prop, oSheet, tblCol = this.getView().getModel("sJSONModel").getData().columns;
				for (var i = 0; i < tblCol.length; i++) {
					// making export columns
					// tblCol[i].description
					lbl = this.getDescriptionbasedonColumn(tblCol[i].name, tblCol[i].description);
					prop = tblCol[i].name;
					expCols.push({
						label: lbl,
						property: prop,
					});
				}

				oSheet = new Spreadsheet({
					workbook: { columns: expCols },
					dataSource: expData,
					fileName: this.getView().byId("idInputRFQNumber").getValue() + "_" + this.dept + " CS"
				});
				oSheet.build().finally(() => oSheet.destroy());
			} else {
				sap.m.MessageToast.show("No data to export");
			}

		},
		onValueHelpRequestedRfq: function (oEvent) {
			if (!this._pDialog) {
				this._pDialog = sap.ui.xmlfragment("com.cfcl.comparativeanalysisui.view.fragments.tableSelectRfq", this);
				this.getView().addDependent(this._pDialog);
				this.rfqTemplate = this._pDialog.getItems()[0].clone();
			}
			let aFilters = [];
			aFilters.push(new Filter({
				filters: [
					new Filter({ path: "Department", operator: 'EQ', value1: 'Purchase' }),
					new Filter({ path: "Department", operator: 'EQ', value1: 'KKBMS' })
				],
				and: false
			}));

			this._pDialog.bindAggregation("items", {
				path: "/RFQList",
				template: this.rfqTemplate,
				filters: aFilters

			});
			this._pDialog.open();
		},
		handleSearchRfq: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			// var oFilter = new Filter("Ebeln", FilterOperator.Contains, sValue);
			var oBinding = oEvent.getSource().getBinding("items");
			let aFilters = [];
			var defaultFilter = new Filter({
				filters: [
					new Filter({ path: "Department", operator: 'EQ', value1: 'Purchase' }),
					new Filter({ path: "Department", operator: 'EQ', value1: 'KKBMS' })
				],
				and: false
			});
			let searchFilter = new Filter({
				filters: [
					new Filter({ path: "Ebeln", operator: "Contains", value1: sValue })
				],
				and: true,
			});
			let finalFilter = new Filter({ filters: [searchFilter, defaultFilter], and: true });
			aFilters.push(finalFilter);
			oBinding.filter(aFilters);
		},
		onConfirmRqfDialog: function (oEvent) {
			var selectItem = oEvent.getParameter("selectedItem");
			var rfq = selectItem.getBindingContext().getObject().Ebeln;
			this.dept = selectItem.getBindingContext().getObject().Department;
			this.byId("idInputRFQNumber").setValue(rfq);
			this.getView().getModel("nfaModel").setProperty("/Department", this.dept);
		},
		handleSearchEvent: function (oEvent) {
			var sValue = oEvent.getParameter("value");
			let aFilters = [];
			var defaultFilter = new Filter({
				filters: [
					new Filter({ path: "Ebeln_Ebeln", operator: 'EQ', value1: this.byId("idInputRFQNumber").getValue() }),
					new Filter({ path: "status", operator: 'NE', value1: 'Draft' })
				],
				and: true
			});
			let searchFilter = new Filter({
				filters: [
					new Filter({ path: "internalId", operator: 'Contains', value1: sValue }),
					new Filter({ path: "title", operator: 'Contains', value1: sValue }),
					new Filter({ path: "status", operator: 'Contains', value1: sValue })
				],
				and: false,
			});
			let finalFilter = new Filter({ filters: [searchFilter, defaultFilter], and: true });
			aFilters.push(finalFilter);


			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},
		handleSelectEvent: function (oEvent) {
			var sobj = oEvent.getParameters().selectedItem.getBindingContext().getObject();
			this.byId("idInputEvent").setTokens([
				new Token({ text: sobj.title + "(" + sobj.internalId + ")", key: sobj.internalId })
			]);
		},
		getItemNumb: function (udf1, udf2) {
			var sReturn = "";
			var type = this.getView().getModel("nfaModel").getProperty("/udf2")
			if (type === "service") {
				// sReturn = sReturn + " ("+ udf2 +")";
				if (udf2 !== "") {
					sReturn = udf2;
				} else {
					sReturn = "";
				}
			} else {
				if (udf1) {
					var stringArray = (udf1.replace(/ /g, "")).split(",");
					var numberArray = stringArray.sort((a, b) => ((typeof b === "number") - (typeof a === "number")) || (a > b ? 1 : -1));;
					numberArray.forEach(function (item) {
						if (item.length < 10) {
						if (sReturn) {
							sReturn = sReturn + ", " + (item.replace(/ /g, "")).replace(/^0+/, '');
						} else {
							sReturn = (item.replace(/ /g, "")).replace(/^0+/, '');
						}
					}
					});
				}
			}
			return sReturn;
		},
		getDescriptionbasedonColumn: function (clName, clDesc) {
			let sReturn = clDesc;
			if (clName === "colA") {
				sReturn = "PR Particulars";
			} else if (clName === "colB") {
				sReturn = "Commercial Headers";
			} else if (clName === "orderDetails") {
				sReturn = "Last PO/ARC Reference";
			}
			return sReturn;
		}
	});
});
