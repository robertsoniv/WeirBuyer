angular.module('orderCloud')
    .service( 'QuoteShareService', QuoteShareService)
    .service('QuoteHelperService', QuoteHelperService)
	.service('QuoteCommentsService', QuoteCommentsService)
    .config(MyQuoteConfig)
	.controller('MyQuoteCtrl', MyQuoteController)
	.controller('MyQuoteDetailCtrl', MyQuoteDetailController)
	.controller('QuoteDeliveryOptionCtrl', QuoteDeliveryOptionController )
	.controller('ReviewQuoteCtrl', ReviewQuoteController)
	.controller('RevisedQuoteCtrl', RevisedQuoteController)
	.controller('ReadonlyQuoteCtrl', ReadonlyQuoteController)
	.controller('QuoteRevisionsCtrl', QuoteRevisionsController)
	.controller('ModalInstanceCtrl', ModalInstanceController)
	.controller('MoreQuoteInfoCtrl', MoreQuoteInfoController)
	.controller('NewAddressModalCtrl', NewAddressModalController)
	.controller('SubmitConfirmCtrl', SubmitConfirmController)
	.controller('SubmitConfirmOrderCtrl', SubmitConfirmOrderController)
	.controller('ChooseSubmitCtrl', ChooseSubmitController)
	.controller('SubmitCtrl',SubmitController)
;

function QuoteShareService() {
    var svc = {
        LineItems: [],
        Payments: [],
	    Comments: [],
	    Quote: null,
	    Me: null
    };
    return svc;
}

function QuoteHelperService($q, OrderCloud) {
    function findRevisions(quoteID) {
        var filter = {
                "xp.OriginalOrderID": quoteID
        };
        return OrderCloud.Orders.ListOutgoing(null, null, null, 1, 100, null, "DateCreated", filter);
    }

    var service = {
        FindQuoteRevisions: findRevisions
    };
    return service;
}

function QuoteCommentsService(OrderCloud, QuoteShareService, Me, $q) {
	var service = {
		AddComment: _addComment
	};

	function _addComment(commentText) {
		var dfd = $q.defer();
		var comment = {
			date: new Date(),
			by: Me.Profile.FirstName + " " + Me.Profile.LastName,
			val: commentText
		};

		// Take the new comment, push it onto the current comments to weir then patch.
		if (!QuoteShareService.Quote.xp.CommentsToWeir || Object.prototype.toString.call(QuoteShareService.Quote.xp.CommentsToWeir) !== '[object Array]') {
			QuoteShareService.Quote.xp.CommentsToWeir = [];
		}
		QuoteShareService.Quote.xp.CommentsToWeir.push(comment);
		OrderCloud.Orders.Patch(QuoteShareService.Quote.ID, {xp: {CommentsToWeir: QuoteShareService.Quote.xp.CommentsToWeir}})
			.then(function (quote) {
				QuoteShareService.Quote = quote;
				dfd.resolve(quote);
			})
			.catch(function(ex) {
				dfd.resolve(ex);
			});
		return dfd.promise;
	}

	return service;
}

function MyQuoteConfig($stateProvider, $sceDelegateProvider) {
	$sceDelegateProvider.resourceUrlWhitelist([
		'self',
		'https://www.global.weir/brands/**',
		'https://**.herokuapp.com/**',
		'https://s3.us-east-2.amazonaws.com/ordercloudtest/**'
	]);
	$stateProvider
		.state('myquote', {
		    parent: 'base',
		    url: '/myquote',
		    templateUrl: 'myquote/templates/myquote.tpl.html',
		    controller: 'MyQuoteCtrl',
		    controllerAs: 'myquote',
		    resolve: {
			    Me: function (OrderCloud) {
				    return OrderCloud.Me.Get();
			    },
			    Customer: function (CurrentOrder) {
				    return CurrentOrder.GetCurrentCustomer();
			    },
		        Quote: function (CurrentOrder) {
		            return CurrentOrder.Get();
		        },
		        ShippingAddress: function (Quote, OrderCloud) {
		            if (Quote.ShippingAddressID) return OrderCloud.Addresses.Get(Quote.ShippingAddressID, OrderCloud.BuyerID.Get());
		            return null;
		        },
		        LineItems: function ($q, $state, toastr, Underscore, CurrentOrder, OrderCloud, LineItemHelpers, QuoteShareService) {
		            QuoteShareService.LineItems.length = 0;
		            var dfd = $q.defer();
		            CurrentOrder.GetID()
                        .then(function (id) {
                            OrderCloud.LineItems.List(id)
                                .then(function (data) {
                                    if (!data.Items.length) {
                                        toastr.error('Your quote does not contain any line items.', 'Error');
                                        dfd.resolve({ Items: [] });
                                    } else {
	                                    LineItemHelpers.GetBlankProductInfo(data.Items);
                                        LineItemHelpers.GetProductInfo(data.Items)
                                            .then(function () { dfd.resolve(data); });
                                    }
                                })
                        })
                        .catch(function () {
                            toastr.error('Your quote does not contain any line items.', 'Error');
                            dfd.resolve({ Items: [] });
                        });
		            return dfd.promise;
		        },
			    PreviousLineItems: function($q, toastr, OrderCloud, Quote, LineItemHelpers) {
				    // We can't have a quantity of 0 on a line item. With show previous line items
				    // Split the current order ID. If a rec exists, get, else do nothing.
				    var pieces = Quote.ID.split('-Rev');
				    if(pieces.length > 1) {
					    var prevId = pieces[0] + "-Rev" + (pieces[1] - 1).toString();
					    var dfd = $q.defer();
					    OrderCloud.LineItems.List(prevId,null,null,null,null,null,null,OrderCloud.BuyerID.Get())
						    .then(function(data) {
							    if (!data.Items.length) {
								    dfd.resolve({ Items: [] });
							    } else {
								    LineItemHelpers.GetBlankProductInfo(data.Items);
								    LineItemHelpers.GetProductInfo(data.Items)
									    .then(function () { dfd.resolve(data); });
							    }
						    })
						    .catch(function () {
							    toastr.error('Previous quote does not contain any line items.', 'Error');
							    dfd.resolve({ Items: [] });
						    });
					    return dfd.promise;
				    } else {
					    return null;
				    }
			    },
		        Payments: function (Quote, OrderCloud) {
		            return OrderCloud.Payments.List(Quote.ID,null,null,null,null,null,null,OrderCloud.BuyerID.Get());
		        },
		        IsBuyer: function (UserGroupsService) {
                    return UserGroupsService.IsUserInGroup([UserGroupsService.Groups.Buyers])
		        },
		        IsShopper: function (UserGroupsService) {
		            return UserGroupsService.IsUserInGroup([UserGroupsService.Groups.Shoppers])
		        }
		    }
		})
		.state('myquote.detail', {
			url: '/detail',
			templateUrl: 'myquote/templates/myquote.detail.tpl.html',
			controller: 'MyQuoteDetailCtrl',
			controllerAs: 'detail'
		})
		.state('myquote.delivery', {
			url: '/delivery',
			templateUrl: 'myquote/templates/myquote.delivery.tpl.html',
			controller: 'QuoteDeliveryOptionCtrl',
			controllerAs: 'delivery',
			resolve: {
				Addresses: function(OrderCloud) {
					return OrderCloud.Addresses.List(null,null,null,null,null,null,OrderCloud.BuyerID.Get());
				}
			}
		})
		.state('myquote.review', {
			url: '/review',
			templateUrl: 'myquote/templates/myquote.review.tpl.html',
			controller: 'ReviewQuoteCtrl',
			controllerAs: 'review'
		})
		.state('myquote.submitquote', {
			url: '/submitquote',
			templateUrl: 'myquote/templates/myquote.review.tpl.html',
			controller: 'ReviewQuoteCtrl',
			controllerAs: 'review'
		})
		.state('revised', {
			parent: 'base',
		    url: '/revised?quoteID&buyerID',
		    templateUrl: 'myquote/templates/myquote.revised.tpl.html',
		    controller: 'RevisedQuoteCtrl',
		    controllerAs: 'revised',
			resolve: {
				Me: function(OrderCloud) {
					return OrderCloud.Me.Get();
				},
				Quote: function ($stateParams, OrderCloud) {
					return OrderCloud.Orders.Get($stateParams.quoteID, $stateParams.buyerID);
				},
				ShippingAddress: function (Quote, OrderCloud) {
					if (Quote.ShippingAddressID) return OrderCloud.Addresses.Get(Quote.ShippingAddressID, OrderCloud.BuyerID.Get());
					return null;
				},
				LineItems: function ($q, toastr, OrderCloud, LineItemHelpers, Quote) {
					//QuoteShareService.LineItems.length = 0;
					var dfd = $q.defer();
					OrderCloud.LineItems.List(Quote.ID)
						.then(function (data) {
							if (!data.Items.length) {
								toastr.error('Your quote does not contain any line items.', 'Error');
								dfd.resolve({ Items: [] });
							} else {
								LineItemHelpers.GetBlankProductInfo(data.Items);
								LineItemHelpers.GetProductInfo(data.Items)
									.then(function () { dfd.resolve(data); });
							}
						})
						.catch(function () {
							toastr.error('Your quote does not contain any line items.', 'Error');
							dfd.resolve({ Items: [] });
						});
					return dfd.promise;
				},
				PreviousLineItems: function($q, toastr, OrderCloud, Quote, LineItemHelpers) {
					// We can't have a quantity of 0 on a line item. With show previous line items
					// Split the current order ID. If a rec exists, get, else do nothing.
					var pieces = Quote.ID.split('-Rev');
					if(pieces.length > 1) {
						var prevId = pieces[0] + "-Rev" + (pieces[1] - 1).toString();
						var dfd = $q.defer();
						OrderCloud.LineItems.List(prevId,null,null,null,null,null,null,OrderCloud.BuyerID.Get())
							.then(function(data) {
								if (!data.Items.length) {
									toastr.error('Previous quote does not contain any line items.', 'Error');
									dfd.resolve({ Items: [] });
								} else {
									LineItemHelpers.GetBlankProductInfo(data.Items);
									LineItemHelpers.GetProductInfo(data.Items)
										.then(function () { dfd.resolve(data); });
								}
							})
							.catch(function () {
								dfd.resolve({ Items: [] });
							});
						return dfd.promise;
					} else {
						return null;
					}
				},
				Payments: function ($stateParams, OrderCloud) {
					return OrderCloud.Payments.List($stateParams.quoteID);
				}
			}
		})
		.state('revisions', {
		    parent: 'base',
		    url: '/revisions?quoteID',
		    templateUrl: 'myquote/templates/myquote.revisions.tpl.html',
		    controller: 'QuoteRevisionsCtrl',
		    controllerAs: 'revisions',
		    resolve: {
		        Revisions: function ($stateParams, QuoteHelperService) {
		            return QuoteHelperService.FindQuoteRevisions($stateParams.quoteID);
		        },
		        QuoteID: function($stateParams) {
		            return $stateParams.quoteID;
		        }
		    }
		})
		.state('readonly', {
			parent: 'base',
		    url: '/readonly?quoteID&buyerID',
		    templateUrl: 'myquote/templates/myquote.readonly.tpl.html',
		    controller: 'ReadonlyQuoteCtrl',
		    controllerAs: 'readonly',
		    resolve: {
				Me: function(OrderCloud) {
					return OrderCloud.Me.Get();
				},
			    Quote: function ($stateParams, OrderCloud) {
				    return OrderCloud.Orders.Get($stateParams.quoteID, $stateParams.buyerID);
			    },
			    ShippingAddress: function (Quote, OrderCloud) {
				    if (Quote.ShippingAddressID) return OrderCloud.Addresses.Get(Quote.ShippingAddressID, OrderCloud.BuyerID.Get());
				    return null;
			    },
			    LineItems: function ($q, toastr, OrderCloud, LineItemHelpers, Quote) {
				    //QuoteShareService.LineItems.length = 0;
				    var dfd = $q.defer();
				    OrderCloud.LineItems.List(Quote.ID)
					    .then(function (data) {
						    if (!data.Items.length) {
							    toastr.error('Your quote does not contain any line items.', 'Error');
							    dfd.resolve({ Items: [] });
						    } else {
							    LineItemHelpers.GetBlankProductInfo(data.Items);
							    LineItemHelpers.GetProductInfo(data.Items)
								    .then(function () { dfd.resolve(data); });
						    }
					    })
					    .catch(function () {
						    toastr.error('Your quote does not contain any line items.', 'Error');
						    dfd.resolve({ Items: [] });
					    });
				    return dfd.promise;
			    },
			    PreviousLineItems: function($q, toastr, OrderCloud, Quote, LineItemHelpers) {
				    // We can't have a quantity of 0 on a line item. With show previous line items
				    // Split the current order ID. If a rec exists, get, else do nothing.
				    var pieces = Quote.ID.split('-Rev');
				    if(pieces.length > 1) {
					    var prevId = pieces[0] + "-Rev" + (pieces[1] - 1).toString();
					    var dfd = $q.defer();
					    OrderCloud.LineItems.List(prevId,null,null,null,null,null,null,OrderCloud.BuyerID.Get())
						    .then(function(data) {
							    if (!data.Items.length) {
								    toastr.error('Previous quote does not contain any line items.', 'Error');
								    dfd.resolve({ Items: [] });
							    } else {
								    LineItemHelpers.GetBlankProductInfo(data.Items);
								    LineItemHelpers.GetProductInfo(data.Items)
									    .then(function () { dfd.resolve(data); });
							    }
						    })
						    .catch(function () {
							    dfd.resolve({ Items: [] });
						    });
					    return dfd.promise;
				    } else {
					    return null;
				    }
			    },
			    Payments: function ($stateParams, OrderCloud) {
				    return OrderCloud.Payments.List($stateParams.quoteID);
			    }
		    }
		})
		.state('submit', {
			parent: 'base',
			url: '/submit?quoteID&buyerID',
			templateUrl: 'myquote/templates/myquote.submit.tpl.html',
			controller: 'SubmitCtrl',
			controllerAs: 'submit',
			resolve: {
				Quote: function ($stateParams, OrderCloud) {
					return OrderCloud.Orders.Get($stateParams.quoteID, $stateParams.buyerID);
				},
				ShippingAddress: function (Quote, OrderCloud) {
					if (Quote.ShippingAddressID) return OrderCloud.Addresses.Get(Quote.ShippingAddressID, OrderCloud.BuyerID.Get());
					return null;
				},
				LineItems: function ($q, toastr, OrderCloud, LineItemHelpers, Quote) {
					//QuoteShareService.LineItems.length = 0;
					var dfd = $q.defer();
					OrderCloud.LineItems.List(Quote.ID)
						.then(function (data) {
							if (!data.Items.length) {
								toastr.error('Your quote does not contain any line items.', 'Error');
								dfd.resolve({ Items: [] });
							} else {
								LineItemHelpers.GetBlankProductInfo(data.Items);
								LineItemHelpers.GetProductInfo(data.Items)
									.then(function () { dfd.resolve(data); });
							}
						})
						.catch(function () {
							toastr.error('Your quote does not contain any line items.', 'Error');
							dfd.resolve({ Items: [] });
						});
					return dfd.promise;
				},
				PreviousLineItems: function($q, toastr, OrderCloud, Quote, LineItemHelpers) {
					// We can't have a quantity of 0 on a line item. With show previous line items
					// Split the current order ID. If a rec exists, get, else do nothing.
					var pieces = Quote.ID.split('-Rev');
					if(pieces.length > 1) {
						var prevId = pieces[0] + "-Rev" + (pieces[1] - 1).toString();
						var dfd = $q.defer();
						OrderCloud.LineItems.List(prevId,null,null,null,null,null,null,OrderCloud.BuyerID.Get())
							.then(function(data) {
								if (!data.Items.length) {
									toastr.error('Previous quote does not contain any line items.', 'Error');
									dfd.resolve({ Items: [] });
								} else {
									LineItemHelpers.GetBlankProductInfo(data.Items);
									LineItemHelpers.GetProductInfo(data.Items)
										.then(function () { dfd.resolve(data); });
								}
							})
							.catch(function () {
								dfd.resolve({ Items: [] });
							});
						return dfd.promise;
					} else {
						return null;
					}
				},
				Payments: function ($stateParams, OrderCloud) {
					return OrderCloud.Payments.List($stateParams.quoteID);
				}
			}
		})
    ;
}

function MyQuoteController($q, $sce, $state, $uibModal, $timeout, $window, toastr, WeirService, Me, Quote, ShippingAddress,
                           Customer, LineItems, Payments, QuoteShareService, imageRoot, QuoteToCsvService, IsBuyer,
                           IsShopper, QuoteCommentsService) {
    var vm = this;
    vm.IsBuyer = IsBuyer;
    vm.IsShopper = IsShopper;
	vm.Quote = Quote;
	vm.Customer = Customer;
	vm.ShippingAddress = ShippingAddress;
	vm.ImageBaseUrl = imageRoot;
	vm.SaveableStatuses = [
		WeirService.OrderStatus.Draft.id,
		WeirService.OrderStatus.Saved.id
	];
	QuoteShareService.Quote = Quote;
	QuoteShareService.Me = Me;
	QuoteShareService.LineItems.push.apply(QuoteShareService.LineItems, LineItems.Items);
	QuoteShareService.Payments = Payments.Items;
	QuoteShareService.Comments = Quote.xp.CommentsToWeir;

	vm.isActive = function(viewLocation) {
		return viewLocation == $state.current.name;
	};

	vm.GetImageUrl = function(img) {
	    return vm.ImageBaseUrl + img;
	};
	vm.HasLineItems = function () {
	    return (QuoteShareService.LineItems && QuoteShareService.LineItems.length);
	};
	vm.Readonly = function () {
	    $state.go("readonly", { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
	};
	vm.imageRoot = imageRoot;
	function toCsv() {
	    return QuoteToCsvService.ToCsvJson(vm.Quote, QuoteShareService.LineItems, vm.ShippingAddress, QuoteShareService.Payments, vm.labels);
	}
	vm.ToCsvJson = toCsv;
	vm.CsvFilename = vm.Quote.ID + ".csv";

	function getStatusLabel() {
	    if (vm.Quote.xp.Status) {
	        var status = WeirService.LookupStatus(vm.Quote.xp.Status);
	        if (status) {
	            return status.label;
	            // TODO: Address localization
	        }
	    }
	    return "";
	}
	function save() {
		if (vm.Quote.xp.Status == WeirService.OrderStatus.Draft.id) {
		    // TODO: FAIL if no line items
		}
		var mods = {
		    Comments: vm.Quote.Comments,
		    xp: {
		        StatusDate: new Date(),
				RefNum: vm.Quote.xp.RefNum,
				Name: vm.Quote.xp.Name
		    }
		};
		var assignQuoteNumber = false;

		if (vm.Quote.xp.Status == WeirService.OrderStatus.Draft.id) {
		    mods.xp.Status = WeirService.OrderStatus.Saved.id;
			mods.xp.Active = true;
		    assignQuoteNumber = true;
		}

		WeirService.UpdateQuote(vm.Quote, mods, assignQuoteNumber, vm.Customer.id)
			.then(function(quote) {
				QuoteShareService.Quote = quote;
				toastr.success(vm.labels.SaveSuccessMessage, vm.labels.SaveSuccessTitle);
				if(assignQuoteNumber) {
					vm.Quote = quote;
					/*var modalInstance = $uibModal.open({
						animation: true,
						ariaLabelledBy: 'modal-title',
						ariaDescribedBy: 'modal-body',
						templateUrl: 'modalConfirmation.html',
						controller: 'ModalInstanceCtrl',
						controllerAs: 'myQuote',
						resolve: {
							quote: function () {
								return vm.Quote;
							},
							labels: function () {
								return vm.labels;
							}
						}
					});
					modalInstance.result;*/
					$window.location.reload();
				}
			});
	}
	function _approve() {
	    if (vm.Quote.xp.Status == 'RV') {
	        var mods = {
	            xp: {
	                StatusDate: new Date(),
	                Status: WeirService.OrderStatus.ConfirmedQuote.id
	            }
	        };
	        WeirService.UpdateQuote(vm.Quote, mods)
            .then(function (qte) {
                toastr.success(vm.labels.ApprovedMessage, vm.labels.ApprovedTitle);
	            $state.go('readonly', { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
            });
	    }
	}

	function _reject() {
	    if (vm.Quote.xp.Status == 'RV') {
	        var mods = {
	            xp: {
	                StatusDate: new Date(),
	                Status: WeirService.OrderStatus.RejectedQuote.id
	            }
	        };
	        WeirService.UpdateQuote(vm.Quote, mods)
            .then(function (qte) {
                toastr.success(vm.labels.RejectedMessage, vm.labels.RejectedTitle);
	            $state.go('readonly', { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
            });
        }
	}

	function gotoDelivery(dirty) {
		if(dirty) {
			save();
		}

		if (!$state.is("myquote.detail") || (vm.Quote.Comments && vm.Quote.xp.RefNum && vm.Quote.xp.Files && vm.Quote.xp.Files.length)) {
            $state.go("myquote.delivery");
		} else {
            var modalInstance = $uibModal.open({
                animation: true,
                ariaLabelledBy: 'modal-title',
                ariaDescribedBy: 'modal-body',
                templateUrl: 'myquote/templates/myquote.missingdetail.tpl.html',
                controller: 'MoreQuoteInfoCtrl',
                controllerAs: 'moreInfo',
				size: 'sm',
                resolve: {
                    quote: function() {
                        return vm.Quote;
                    }
                }
            });
            modalInstance.result;
		}
	}
	function noItemsMessage() {
        toastr.error(vm.labels.NoItemsError);
	}
	function cannotContinueNoItemsMessage() {
		toastr.error(vm.labels.CannotContinueNoItems);
	}
	function share() {
		alert("TODO: Implement share quote");
	}
	function download() {
		$timeout($window.print,1);
	}
	function print() {
		$timeout($window.print,1);
	}
	function _next() {
		// ToDo combine gotoDelivery() and next(), iot handle the "workflow" in one spot.
		var goto = {
			"myquote.detail":"myquote.delivery",
			"myquote.delivery":"myquote.review",
			"myquote.review":"myquote.submitquote"
		};
		var isValidForReview = function () {
			return vm.Quote.ShippingAddressID != null && vm.HasLineItems();
		};
		if(isValidForReview()) {
			$state.go(goto[$state.current.name]);
		}
	}

	var labels = {
	    en: {
	        YourQuote: "Your Quote",
	        QuoteNumber: "Quote number; ",
	        QuoteName: "Add your Quote Name ",
	        YourReference: "Your Reference No; ",
	        DeliveryOptions: "Delivery Options",
	        ReviewQuote: "Review Quote",
	        SubmitQuote: "Submit Quote or Order",
            PONumber: "PO Number",
            SerialNum: "Serial Number",
            TagNum: "Tag Number (if available)",
            PartNum: "Part Number",
            PartDesc: "Description of Part",
            RecRepl: "Recommended Replacement",
            LeadTime: "Lead Time",
            PricePer: "Price per Item or Set",
            Quantity: "Quantity",
            Total: "Total",
            DeliveryAddress: "Delivery Address",
            Save: "Save",
	        Share: "Share",
	        Download: "Download",
	        Print: "Print",
	        SaveSuccessTitle: "Quote Saved",
	        SaveSuccessMessage: "Your Changes Have Been Saved",
	        NoItemsError: "Please Add Parts to Quote Before Saving",
	        CannotContinueNoItems: "Please Add Parts to Quote Before Continuing",
	        SaveBody: "Your Quote Has Been Saved.",
	        SaveFooter: "View Your Quotes",
	        Approve: "Approve",
	        Reject: "Reject",
	        Comments: "Comments",
	        Status: "Status",
	        OrderDate: "Order date;",
	        RejectedMessage: "The revised quote has been rejected.",
	        RejectedTitle: "Quote Updated",
	        ApprovedMessage: "The revised quote has been accepted",
	        ApprovedTitle: "Quote Updated",
	        SubmitWithPO: "Submit Order",
	        PriceDisclaimer: "All prices stated do not include UK VAT or delivery",
		    ReplacementGuidance: "Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
		    POAGuidance: "POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
		    LeadTimeNotice: "Lead time for all orders will be based on the longest lead time from the list of spares requested"
	    },
		fr: {
		    YourQuote: $sce.trustAsHtml("Votre Cotation"),
		    QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation"),
		    QuoteName: $sce.trustAsHtml("Ajoutez votre nom de devis "),
		    YourReference: $sce.trustAsHtml("Votre num&eacute;ro de r&eacute;f&eacute;rence; "),
		    DeliveryOptions: $sce.trustAsHtml("Options de livraison"),
		    ReviewQuote: $sce.trustAsHtml("R&eacute;viser votre cotation"),
			SubmitQuote: $sce.trustAsHtml("FR: Submit Quote or Order"),
			PONumber: $sce.trustAsHtml("FR: PO Number"),
			SerialNum: $sce.trustAsHtml("Num&eacute;ro de S&eacute;rie"),
			TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
			PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
			PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
			RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute;"),
			LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison"),
			PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
			Quantity: $sce.trustAsHtml("Quantit&eacute;"),
			Total: $sce.trustAsHtml("Total"),
			DeliveryAddress: $sce.trustAsHtml("Adresse de livraison"),
			Save: $sce.trustAsHtml("Sauvegarder"),
			Share: $sce.trustAsHtml("Partager"),
			Download: $sce.trustAsHtml("T&eacute;l&eacute;charger"),
			Print: $sce.trustAsHtml("Imprimer"),
			SaveSuccessTitle: $sce.trustAsHtml("Cotation enregistr&eacute;e"),
			SaveSuccessMessage: $sce.trustAsHtml("Vos modifications ont &eacute;t&eacute; enregistr&eacute;es"),
			NoItemsError: $sce.trustAsHtml("Veuillez ajouter des pi&egrave;ces de rechanges avant de sauvegarder"),
			CannotContinueNoItems: $sce.trustAsHtml("Veuillez ajouter des pi&egrave;ces de rechanges avant de continuer"),
			SaveBody: $sce.trustAsHtml("FR: Your quote has been saved."),
			SaveFooter: $sce.trustAsHtml("Voir vos devis"),
			Approve: $sce.trustAsHtml("Approuver"),
			Reject: $sce.trustAsHtml("Rejeter"),
			Comments: $sce.trustAsHtml("Commentaires"),
			Status: $sce.trustAsHtml("Statut"),
			OrderDate: $sce.trustAsHtml("Date de commande;"),
			RejectedMessage: $sce.trustAsHtml("La cotation r&eacute;vis&eacute;e a &eacute;t&eacute; rejet&eacute;e."),
			RejectedTitle: $sce.trustAsHtml("Cotation mise &agrave; jour"),
			ApprovedMessage: $sce.trustAsHtml("La cotation r&eacute;vis&eacute;e a &eacute;t&eacute; accept&eacute;e"),
			ApprovedTitle: $sce.trustAsHtml("Cotation mise &agrave; jour"),
			SubmitWithPO: $sce.trustAsHtml("Soumettre une commande avec bon de commande"),
			PriceDisclaimer: $sce.trustAsHtml("FR - All prices stated do not include UK VAT or delivery"),
			ReplacementGuidance: $sce.trustAsHtml("FR Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares."),
			POAGuidance: $sce.trustAsHtml("FR POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request."),
			LeadTimeNotice: $sce.trustAsHtml("FR Lead time for all orders will be based on the longest lead time from the list of spares requested")
		}
	};

	vm.AddNewComment = function(CommentToBeAdded) {
		var dfd = $q.defer();
		if (CommentToBeAdded) {
			QuoteCommentsService.AddComment(CommentToBeAdded)
				.then(function(result) {
					QuoteShareService.Quote = result;
					dfd.resolve(result);
				})
		} else {
			toastr.info("Cannot save an empty comment.","Empty Comment");
			dfd.resolve();
		}
		return dfd.promise;
	};

	vm.labels = WeirService.LocaleResources(labels);
	vm.GotoDelivery = gotoDelivery;
	vm.Save = save;
	vm.NoItemsMessage = noItemsMessage;
	vm.CannotContinueNoItemsMessage = cannotContinueNoItemsMessage;
	vm.Share = share;
	vm.Download = download;
	vm.Print = print;
	vm.GetStatusLabel = getStatusLabel;
	vm.Approve = _approve;
	vm.Reject = _reject;
	vm.Next = _next;
}

function MyQuoteDetailController(WeirService, $state, $sce, $exceptionHandler, $scope, $rootScope, OrderCloud, QuoteShareService) {
    if ((QuoteShareService.Quote.xp.Status == WeirService.OrderStatus.RevisedQuote.id) ||
        (QuoteShareService.Quote.xp.Status == WeirService.OrderStatus.RevisedOrder.id)) {
        $state.go("revised", {quoteID: QuoteShareService.Quote.ID, buyerID: OrderCloud.BuyerID.Get()});
    }
	var vm = this;
	vm.Quote = QuoteShareService.Quote;
	vm.NewComment = null;
	vm.LineItems = QuoteShareService.LineItems;
	vm.Comments = QuoteShareService.Comments;
	var labels = {
		en: {
            Customer: "Customer; ",
            QuoteNumber: "Quote Number; ",
            QuoteName: "Add your Quote Name ",
            AddNew: "Add New Items",
            SerialNum: "Serial Number",
            TagNum: "Tag Number (if available)",
            PartNum: "Part Number",
            PartDesc: "Description of Part",
            RecRepl: "Recommended Replacement",
            LeadTime: "Lead Time",
            PricePer: "Price per Item Or Set",
            Quantity: "Quantity",
            Total: "Total",
            UploadHeader: "Upload your Service or Operating Condition Document",
            RefNumHeader: "Add your Reference Number ",
            CommentsHeader: "Your Comments or Instructions",
		    DeliveryOptions: "Delivery Options",
			Update: "Update",
			DragAndDrop: "Save your Draft before Uploading Documents.",
			Add: "Add",
			Cancel: "Cancel",
			Comments: "Comments",
			AddedComment: " added a comment - ",
			PriceDisclaimer: "All prices stated do not include UK VAT or delivery"
		},
		fr: {
			Customer: $sce.trustAsHtml("Client"),
			QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation"),
			QuoteName: $sce.trustAsHtml("FR: Ajoutez votre nom de devis "),
			AddNew: $sce.trustAsHtml("Ajouter un item"),
			SerialNum: $sce.trustAsHtml("Num&eacute;ro de S&eacute;rie"),
			TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
			PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
			PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
			RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute;"),
			LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison"),
			PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
			Quantity: $sce.trustAsHtml("Quantit&eacute;"),
			Total: $sce.trustAsHtml("Total"),
			UploadHeader: $sce.trustAsHtml("T&eacute;l&eacute;charger vos documents concernant vos conditions de services"),
            UploadInstruct: $sce.trustAsHtml("Veuillez t&eacute;l&eacute;charger tout type de document concernant vos soupapes ou vos pi&egrave;ces de rechanges. De ce fait, nous pouvons les utiliser comme r&eacute;f&eacute;rence pour cette cotation."),
            RefNumHeader: $sce.trustAsHtml("Ajouter votre num&eacute;ro de r&eacute;f&eacute;rence"),
            CommentsHeader: $sce.trustAsHtml("Vos commentaires ou instructions"),
            CommentsInstr: $sce.trustAsHtml("Veuillez ajouter tout commentaire ou instructions sp&eacute;cifiques pour cette cotation"),
            DeliveryOptions: $sce.trustAsHtml("Options de livraison"),
			Update: $sce.trustAsHtml("Mettre &agrave; jour"),
			DragAndDrop: $sce.trustAsHtml("Enregistrez votre ébauche avant de télécharger des documents."),
			Add: "FR: Add",
			Cancel: "FR: Cancel",
			Comments: "FR: Comments",
			AddedComment: "FR: added a comment - ",
			PriceDisclaimer: "FR: All prices stated do not include UK VAT or delivery"
		}
	};
	vm.labels = WeirService.LocaleResources(labels);

	vm.deleteLineItem = _deleteLineItem;
	function _deleteLineItem(quoteNumber, itemid) {
		OrderCloud.LineItems.Delete(quoteNumber, itemid, OrderCloud.BuyerID.Get())
			.then(function() {
				// Testing. Should make another event for clarity. At this time I believe it just updates the cart items.
				$rootScope.$broadcast('SwitchCart', quoteNumber, itemid); //This kicks off an event in cart.js
			})
			.then(function() {
				//$state.reload($state.current, {}, {reload:true}); This is bugged: https://github.com/angular-ui/ui-router/issues/582
				$state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
			})
			.catch(function(ex){
				$exceptionHandler(ex);
			});
	}

	vm.updateLineItem = _updateLineItem;
	function _updateLineItem(quoteNumber, item) {
		var patch = {
			Quantity: item.Quantity
		};
		OrderCloud.LineItems.Patch(quoteNumber, item.ID, patch, OrderCloud.BuyerID.Get())
			.then(function(resp) {
				$rootScope.$broadcast('SwitchCart', quoteNumber, resp.ID);
			})
			.then(function() {
				//$state.reload($state.current, {}, {reload:true}); This is bugged: https://github.com/angular-ui/ui-router/issues/582
				$state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
			})
			.catch(function(ex) {
				$exceptionHandler(ex);
			});
	}

	vm.AddComment = function() {
		$scope.$parent.myquote.AddNewComment(vm.NewComment)
			.then(function(result) {
				vm.Comments = result.xp.CommentsToWeir;
			});
		vm.NewComment = null;
	}

}

function QuoteDeliveryOptionController($uibModal, WeirService, $state, $sce, $exceptionHandler, Underscore, toastr, Addresses, OrderCloud, QuoteShareService, OCGeography) {
	var vm = this;
	var activeAddress = function(address) { return address.xp.active == true; };
	vm.addresses = Underscore.sortBy(Addresses.Items, function(address) {
		return address.xp.primary;
	}).filter(activeAddress).reverse();

	//if the QuoteShareService.Quote.ShippingAddressID is null, set it to the vm.addresses[0] if the vm.addresses.length > 0
	if(QuoteShareService.Quote.ShippingAddressID == null && vm.addresses.length > 0) {
		//function _setShippingAddress(QuoteID, Address) {
		_setShippingAddress(QuoteShareService.Quote.ID, vm.addresses[0]);
	}

	vm.country = function(c) {
		var result = Underscore.findWhere(OCGeography.Countries, {value:c});
		return result ? result.label : '';
	};

	var labels = {
	    en: {
	        DefaultAddress: "Your Default Address",
	        AddNew: "Add a New Address",
	        DeliveryInfo: "Delivery Information",
	        DeliverHere: "Deliver to this Address",
	        ReviewQuote: "Review Quote",
	        BackToQuote: "Back to your Quote",
	        InfoText1: "Delivery costs will be confirmed on Order.",
	        InfoText2: "Deliveries will be prepared for shipping based on your standard delivery instructions.",
	        InfoText3: "Lead time for all orders will be based on the longest lead time from the list of spares requested."
	    },
	    fr: {
	        DefaultAddress: $sce.trustAsHtml("Votre adresse par d&eacute;faut"),
	        AddNew: $sce.trustAsHtml("Ajouter une nouvelle adresse"),
	        DeliveryInfo: $sce.trustAsHtml("Informations de livraison"),
	        DeliverHere: $sce.trustAsHtml("Livrer &agrave; cette adresse"),
	        ReviewQuote: $sce.trustAsHtml("Revue de cotation"),
	        BackToQuote: $sce.trustAsHtml("Retour &agrave; votre cotation"),
	        InfoText1: $sce.trustAsHtml("Les frais de livraison seront confirm&eacute;s &agrave; la commande."),
	        InfoText2: $sce.trustAsHtml("Les livraisons seront pr&eacute;par&eacute;es pour l'exp&eacute;dition sur la base de vos instructions de livraison standard."),
	        InfoText3: $sce.trustAsHtml("Le d&eacute;lai de livraison pour toutes les commandes sera bas&eacute; sur le d&eacute;lai le plus long de la liste des pi&egrave;ces de rechanges demand&eacute;es")
	    }
	};

	// We do this so we can display the addresses in a two column table.
	vm.ChunkedData = _chunkData(vm.addresses,2);
	function _chunkData(arr,size) {
		var newArray = [];
		for(var i=0;i<arr.length;i+=size) {
			newArray.push(arr.slice(i,i+size));
		}
		return newArray;
	}

	vm.setShippingAddress = _setShippingAddress;
	function _setShippingAddress(QuoteID, Address) {
		OrderCloud.Orders.SetShippingAddress(QuoteID, Address, OrderCloud.BuyerID.Get())
			.then(function(order) {
				$state.go($state.current, {}, {reload: true});
				toastr.success("Shipping address successfully selected.","Success!");
			})
			.catch(function(ex) {
				$exceptionHandler(ex);
			});
	}

	vm.SaveCustomAddress = _saveCustomAddress;
	function _saveCustomAddress() { return true; }

	vm.CustomShipping = _customShipping;
	function _customShipping(QuoteID) {
		var modalInstance = $uibModal.open({
			animation: true,
			templateUrl: 'newAddress.html',
			controller: 'NewAddressModalCtrl',
			controllerAs: 'NewAddressModal',
			size: 'lg'
		});

		var newAddressResults = {};
		modalInstance.result
			.then(function (address) {
				return OrderCloud.Addresses.Create(address, OrderCloud.BuyerID.Get());
			})
			.then(function(newAddress) {
				newAddressResults.ID = newAddress.ID;
				newAddressResults.Name = newAddress.AddressName;
				return OrderCloud.Orders.SetShippingAddress(QuoteID, newAddress, OrderCloud.BuyerID.Get());
			})
			.then(function() {
				return WeirService.AssignAddressToGroups(newAddressResults.ID);
			})
			.then(function() {
				$state.go($state.current, {}, {reload: true});
				toastr.success("Shipping address set to " + newAddressResults.Name,"Shipping Address Set");
			})
			.catch(function(ex) {
				if(ex !== 'cancel') {
					$exceptionHandler(ex);
				}
			});
	}

	vm.labels = WeirService.LocaleResources(labels);
}

function ReviewQuoteController(WeirService, $state, $sce, $exceptionHandler, $rootScope, $uibModal, toastr,
    OrderCloud, QuoteShareService, Underscore, OCGeography, CurrentOrder, Me, Customer, fileStore, FilesService,
	$scope, FileSaver) {
    var vm = this;
	if( (typeof(QuoteShareService.Quote.xp) == 'undefined') || QuoteShareService.Quote.xp == null) QuoteShareService.Quote.xp = {};
	//if( (typeof(QuoteShareService.Quote.xp.CommentsToWeir) == 'undefined') || QuoteShareService.Quote.xp.CommentsToWeir == null) QuoteShareService.Quote.xp.CommentsToWeir = [];
	vm.LineItems = QuoteShareService.LineItems;
    vm.Quote = QuoteShareService.Quote;
	vm.Comments = QuoteShareService.Comments;
    //vm.CommentsToWeir = QuoteShareService.Quote.xp.CommentsToWeir && QuoteShareService.Quote.xp.CommentsToWeir.length ? QuoteShareService.Quote.xp.CommentsToWeir[0].val : ""; //ToDo comments to weir is now an array. at this point we just keep modifying comment[0];
    vm.PONumber = "";
    var payment = (QuoteShareService.Payments.length > 0) ? QuoteShareService.Payments[0] : null;
    if (payment && payment.xp && payment.xp.PONumber) vm.PONumber = payment.xp.PONumber;
    vm.country = function (c) {
        var result = Underscore.findWhere(OCGeography.Countries, { value: c });
        return result ? result.label : '';
    };
    vm.Step = $state.is('myquote.review') ? "Review" : ($state.is('myquote.submitquote') ? "Submit" : "Unknown");
    vm.SubmittingToReview = false;
    vm.SubmittingWithPO = false;
	// TODO: Updates so that the user can come back to a submitted order, and submit with the PO. Might need to add extra code so that when just adding
	// a PO, we do not re-submit the Order: simply add the PO and change the status.
	if(vm.Quote.xp.PendingPO == true &&($state.$current.name == "myquote.submitquote") && (vm.Quote.xp.Status == WeirService.OrderStatus.ConfirmedQuote.id || vm.Quote.xp.Type=="Order")) {
		vm.SubmittingWithPO = true;
	}
    // TODO: Also add condition that user has Buyer role
    var allowNextStatuses = [WeirService.OrderStatus.Draft.id, WeirService.OrderStatus.Saved.id];
	// TODO a user could have multiple rolls or groups. look for the usermembership in the buyers group.
    vm.ShowNextButton = allowNextStatuses.indexOf(vm.Quote.xp.Status) > -1;
					//(QuoteShareService.Me.xp.Roles && QuoteShareService.Me.xp.Roles.indexOf("Buyer") > -1) &&
                            //((vm.Quote.xp.Status == WeirService.OrderStatus.ConfirmedQuote.id) ||
                            //(vm.Quote.FromUserID == QuoteShareService.Me.ID && (allowNextStatuses.indexOf(vm.Quote.xp.Status) > -1)));
	vm.fileStore = fileStore;
    var labels = {
        en: {
            Customer: "Customer; ",
            QuoteNumber: "Quote Number; ",
            QuoteName: "Quote Name; ",
	        NextStep: "Submit Quote or Order",
            Submit: "Submit Quote or Order",
            BackToReview: "Review Quote",
            BackToDelivery: "Back to Delivery",
            TagNum: "Tag Number (if available)",
            PartNum: "Part Number",
            PartDesc: "Description of Part",
            RecRepl: "Recommended Replacement",
            LeadTime: "Lead Time",
            PricePer: "Price per Item or Set",
            Quantity: "Quantity",
            Total: "Total",
            YourAttachments: "Your Attachments",
            YourReference: "Your Reference No; ",
            CommentsHeader: "Your Comments or Instructions",
            CommentsInstr: "Please Add any Specific Comments or Instructions for this Quote",
            DeliveryOptions: "Delivery Options",
            DeliveryAddress: "Delivery Address",
            ChangeAddr: "Change Address",
            Update: "Update",
            WeirComment: "Comment",
            AddComment: "Add",
            CancelComment: "Cancel",
            SubmitForReview: "Submit Quote for Review",
            CommentSavedMsg: "Your Quote has been Updated",
            PONeededHeader: "Please provide a Purchase Order to finalise your Order",
            POUpload: "Upload PO Document",
            POEntry: "Enter PO Number",
            SubmitOrderAndEmail: "Submit Order & Email PO",
	        SubmitOrderWithPO: "Submit Order",
	        SerialNum: "Serial Number",
	        EmailPoMessage: "*Your order will be confirmed<br class='message-break'>following receipt of your PO.",
	        Add: "Add",
	        Cancel: "Cancel",
	        Comments: "Comments",
	        AddedComment: " added a comment - "
        },
        fr: {
            Customer: $sce.trustAsHtml("Client "),
            QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation "),
            QuoteName: $sce.trustAsHtml("Nom de la cotation "),
            NextStep: $sce.trustAsHtml("FR: Submit Quote or Order"),
            Submit: $sce.trustAsHtml("FR: Submit quote or order"),
            BackToReview: $sce.trustAsHtml("Review quote"),
            BackToDelivery: $sce.trustAsHtml("Retour &agrave; la livraison"),
            TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
            PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
            PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
            RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute;"),
            LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison"),
            PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
            Quantity: $sce.trustAsHtml("Quantit&eacute;"),
            Total: $sce.trustAsHtml("Total"),
            YourAttachments: $sce.trustAsHtml("Vos pi&eacute;ces jointes"),
            YourReference: $sce.trustAsHtml("Votre num&eacute;ro de r&eacute;f&eacute;rence; "),
            CommentsHeader: $sce.trustAsHtml("Vos commentaires ou instructions"),
            CommentsInstr: $sce.trustAsHtml("Veuillez ajouter tout commentaire ou instructions sp&eacute;cifiques pour cette cotation"),
            DeliveryOptions: $sce.trustAsHtml("Options de livraison"),
            DeliveryAddress: $sce.trustAsHtml("Adresse de livraison"),
            ChangeAddr: $sce.trustAsHtml("Changer d'adresse"),
            Update: $sce.trustAsHtml("Mettre à jour"),
            WeirComment: $sce.trustAsHtml("Commenter"),
            AddComment: $sce.trustAsHtml("Ajouter"),
            CancelComment: $sce.trustAsHtml("Annuler"),
            SubmitForReview: $sce.trustAsHtml("Soumettre votre devis pour examen"),
            CommentSavedMsg: $sce.trustAsHtml("Votre devis a &eacute;t&eacute; mis &agrave; jour"),
            PONeededHeader: $sce.trustAsHtml("Veuillez fournir un bon de commande pour finaliser votre commande"),
            POUpload: $sce.trustAsHtml("T&eacute;l&eacute;charger le bon de commande"),
            SubmitOrderAndEmail: $sce.trustAsHtml("Soumettre une commande & E-Mail de pi&egrave;ce de rechange"),
            SubmitOrderWithPO: $sce.trustAsHtml("Soumettre une commande avec bon de commande"),
            SerialNum: $sce.trustAsHtml("Num&eacute;ro de s&eacute;rie"),
	        EmailPoMessage: $sce.trustAsHtml("FR: Your order will be confirmed<br>following receipt of your PO."),
	        Add: "FR: Add",
	        Cancel: "FR: Cancel",
	        Comments: "FR: Comments",
	        AddedComment: "FR: added a comment - "
        }
    };
    vm.labels = WeirService.LocaleResources(labels);

	vm.GetFile = function(fileName) {
		var orderid = vm.Quote.xp.OriginalOrderID ? vm.Quote.xp.OriginalOrderID : vm.Quote.ID;

		FilesService.Get(orderid + fileName)
			.then(function(fileData) {
				console.log(fileData);
				var file = new Blob([fileData.Body], {type: fileData.ContentType});
				FileSaver.saveAs(file, fileName);
				//var fileURL = URL.createObjectURL(file);
				//window.open(fileURL, "_blank");
			});
	};

    function _deleteLineItem(quoteNumber, itemid) {
        OrderCloud.LineItems.Delete(quoteNumber, itemid, OrderCloud.BuyerID.Get())
			.then(function () {
			    // Testing. Should make another event for clarity. At this time I believe it just updates the cart items.
			    $rootScope.$broadcast('SwitchCart', quoteNumber, itemid); //This kicks off an event in cart.js
			})
			.then(function () {
				//$state.reload($state.current, {}, {reload:true}); This is bugged: https://github.com/angular-ui/ui-router/issues/582
				$state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
			})
			.catch(function (ex) {
			    $exceptionHandler(ex);
			});
    }

    function _updateLineItem(quoteNumber, item) {
    	var patch = {
		    Quantity: item.Quantity
	    };
        OrderCloud.LineItems.Patch(quoteNumber, item.ID, patch, OrderCloud.BuyerID.Get())
			.then(function (resp) {
			    $rootScope.$broadcast('LineItemAddedToCart', quoteNumber, resp.ID);
			})
			.then(function () {
				//$state.reload($state.current, {}, {reload:true}); This is bugged: https://github.com/angular-ui/ui-router/issues/582
				$state.transitionTo($state.current, $state.$current.params, { reload: true, inherit: true, notify: true });
			})
			.catch(function (ex) {
			    $exceptionHandler(ex);
			});
    }

    function _gotoDelivery() {
        $state.go("myquote.delivery");
    }
    function _gotoSubmit() {
        $state.go("myquote.submitquote");
    }
    function _gotoReview() {
        $state.go("myquote.review");
    }

    function _proceedToSubmit() {
        vm.SubmittingToReview = false;
        vm.SubmittingWithPO = false;
        if (!$state.is('myquote.submitquote')) return;
        var modalInstance = $uibModal.open({
            animation: true,
            ariaLabelledBy: 'modal-title',
            ariaDescribedBy: 'modal-body',
            templateUrl: 'myquote/templates/myquote.submitorconfirm.tpl.html',
            controller: 'ChooseSubmitCtrl',
            controllerAs: 'choosesubmit'
        });
        modalInstance.result.then(
                function (val) {
                    if (val == "Review") {
                        vm.SubmittingToReview = true;
                    } else if (val == "Submit") {
						vm.SubmittingWithPO = true;
                    }
                }
            );
    }

    // ToDo Accept a parameter withPO. It will be true or false.
    function _submitOrder(withPO) {
        if (payment == null) {
            if (vm.PONumber) {
                var data = {
                    Type: "PurchaseOrder",
                    xp: {
                        PONumber: vm.PONumber
                    }
                };
                OrderCloud.Payments.Create(vm.Quote.ID, data, OrderCloud.BuyerID.Get())
                    .then(function (pmt) {
                        QuoteShareService.Payments.push(pmt);
                        payment = pmt;
                        completeSubmit(withPO);
                    })
            } else {
            	// email the PO later. Can we acutally submit without a PO?
	            completeSubmit(withPO);
            }
        } else if (!payment.xp || payment.xp.PONumber != vm.PONumber) {
            var data = {
                xp: {
                    PONumber: vm.PONumber
                }
            };
            OrderCloud.Payments.Patch(vm.Quote.ID, payment.ID, data, OrderCloud.BuyerID.Get())
                .then(function (pmt) {
                    QuoteShareService.Payments[0] = pmt;
                    payment = pmt;
                    completeSubmit(withPO);
                })
        } else {
            completeSubmit(withPO);
        }
    }

    function completeSubmit(withPO) {
    	var data = {};
    	if(withPO) {
		    data = {
			    xp: {
				    Status: WeirService.OrderStatus.SubmittedWithPO.id,
				    StatusDate: new Date(),
				    Type: "Order",
				    Revised: false,
				    PONumber: vm.PONumber
			    }
		    };
	    } else {
		    data = {
			    xp: {
				    Status: WeirService.OrderStatus.SubmittedPendingPO.id,
				    StatusDate: new Date(),
				    Type: "Order",
				    PendingPO: true,
				    Revised: false,
				    PONumber: "Pending"
			    }
		    };
	    }

	    WeirService.UpdateQuote(vm.Quote, data)
            .then(function (qt) {
                return OrderCloud.Orders.Submit(vm.Quote.ID);
            })
            .then(function (info) {
                CurrentOrder.Set(null);
            })
           .then(function () {
               var modalInstance = $uibModal.open({
                   animation: true,
                   ariaLabelledBy: 'modal-title',
                   ariaDescribedBy: 'modal-body',
                   templateUrl: 'myquote/templates/myquote.orderplacedconfirm.tpl.html',
                   size: 'lg',
                   controller: 'SubmitConfirmCtrl',
                   controllerAs: 'submitconfirm',
                   resolve: {
                       Quote: function () {
                           return vm.Quote;
                       },
	                   WithPO: function() {
							return withPO;
	                   }
                   }
               })
               .closed.then(function () {
               	   $rootScope.$broadcast('OC:RemoveOrder');
                   $state.go("home");
               });
           });
    }

    vm.NewComment = null;
	vm.AddComment = function() {
		$scope.$parent.myquote.AddNewComment(vm.NewComment)
			.then(function(result) {
				vm.Comments = result.xp.CommentsToWeir;
			});
		vm.NewComment = null;
	};

    function _submitForReview(dirty) {
	    var data = {};
	    if(dirty) {
		    data = {
			    xp: {
				    Status: WeirService.OrderStatus.Submitted.id,
				    StatusDate: new Date(),
				    Revised: false
			    }
		    };
	    } else {
	    	data = {
			    xp: {
				    Status: WeirService.OrderStatus.Submitted.id,
				    StatusDate: new Date(),
				    Revised: false
			    }
		    };
	    }
	    WeirService.UpdateQuote(vm.Quote, data)
		    .then(function (qt) {
			    return OrderCloud.Orders.Submit(vm.Quote.ID);
		    })
		    .then(function (info) {
			    CurrentOrder.Set(null);
		    })
		    .then(function () {
			    var modalInstance = $uibModal.open({
				    animation: true,
				    ariaLabelledBy: 'modal-title',
				    ariaDescribedBy: 'modal-body',
				    templateUrl: 'myquote/templates/myquote.orderplacedconfirm.tpl.html',
				    size: 'lg',
				    controller: 'SubmitConfirmOrderCtrl',
				    controllerAs: 'submitconfirm',
				    resolve: {
					    Quote: function () {
						    return vm.Quote;
					    }
				    }
			    })
				    .closed.then(function () {
					    $rootScope.$broadcast('OC:RemoveOrder');
					    $state.go("home");
				    });
		    });

    }

    vm.deleteLineItem = _deleteLineItem;
    vm.updateLineItem = _updateLineItem;
    vm.proceedToSubmit = _proceedToSubmit;
    vm.submitForReview = _submitForReview;
    vm.submitOrder = _submitOrder;
    vm.backToDelivery = _gotoDelivery;
    vm.toSubmit = _gotoSubmit;
    vm.toReview = _gotoReview;
}

function RevisedQuoteController(WeirService, $state, $sce, $timeout, $window, OrderCloud,  Underscore, OCGeography,
	Quote, ShippingAddress, LineItems, PreviousLineItems, Payments, imageRoot, toastr, Me, fileStore, FilesService, FileSaver) {
    var vm = this;
	vm.ImageBaseUrl = imageRoot;
	vm.Zero = 0;
    vm.LineItems = LineItems.Items;
	vm.BuyerID = OrderCloud.BuyerID.Get();
	if(PreviousLineItems) {
		vm.PreviousLineItems = Underscore.filter(PreviousLineItems.Items, function (item) {
			if(item.ProductID == "PLACEHOLDER") {
				var found = false;
				angular.forEach(LineItems.Items, function(value, key) {
					if(value.xp.SN == item.xp.SN) {
						found = true;
						return;
					}
				});
				if(found) {
					return;
				} else {
					return item;
				}
			} else {
				if (Underscore.findWhere(LineItems.Items, {ProductID:item.ProductID})) {
					return;
				} else {
					return item;
				}
			}
		});
	} else {
		vm.PreviousLineItems = null;
	}
    vm.Quote = Quote;
	vm.ShippingAddress = ShippingAddress;
    vm.CommentsToWeir = Quote.xp.CommentsToWeir;
    vm.PONumber = "";
	vm.Payments = Payments.Items;
    var payment = (vm.Payments.length > 0) ? vm.Payments[0] : null;
    if (payment && payment.xp && payment.xp.PONumber) vm.PONumber = payment.xp.PONumber;
    vm.country = function (c) {
        var result = Underscore.findWhere(OCGeography.Countries, { value: c });
        return result ? result.label : '';
    };
	vm.ShowCommentBox = false;
	vm.CommentToWeir = "";
	vm.fileStore = fileStore;

    var labels = {
        en: {
            Customer: "Customer; ",
            QuoteNumber: "Quote Number; ",
            QuoteName: "Quote Name; ",
            BackToQuotes: "Back to your Quotes",
            SerialNum: "Serial Number",
            TagNum: "Tag Number (if available)",
            PartNum: "Part Number",
            PartDesc: "Description of Part",
            RecRepl: "Recommended Replacement (yrs)",
            LeadTime: "Lead Time / Availability (days)",
            PricePer: "Price per Item",
            Quantity: "Quantity",
            Total: "Total",
            Removed: "Removed",
            Updated: "Updated",
            New: "New",
            YourAttachments: "Your Attachments",
            YourReference: "Your Reference No; ",
            CommentsHeader: "Your Comments or Instructions",
            DeliveryAddress: "Delivery Address",
            ViewRevisions: "View Previous Revisions",
	        Save: "Save",
	        Share: "Share",
	        Download: "Download",
	        Print: "Print",
	        Approve: "Approve",
	        Reject: "Reject",
	        Comments: "Comments",
	        Status: "Status",
	        OrderDate: "Order Date;",
	        RejectedMessage: "The Revised Quote has been Rejected.",
	        RejectedTitle: "Quote Updated",
	        ApprovedMessage: "The Revised Quote has been Accepted",
	        ApprovedTitle: "Quote Updated",
	        Comment: "Comment",
	        AddedComment: " added a comment - ",
	        Add: "Add",
	        Cancel: "Cancel",
	        PriceDisclaimer: "All prices stated do not include UK VAT or delivery",
	        ReplacementGuidance: "Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
	        POAGuidance: "POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
	        LeadTimeNotice: "Lead time for all orders will be based on the longest lead time from the list of spares requested"
        },
        fr: {
            Customer: $sce.trustAsHtml("Client "),
            QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation "),
            QuoteName: $sce.trustAsHtml("Nom de la cotation "),
            BackToQuotes: $sce.trustAsHtml("Retour &agrave; vos devis"),
            SerialNum: $sce.trustAsHtml("Num&eacute;ro de S&eacute;rie"),
            TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
            PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
            PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
            RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute; (yrs)"),
            LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison (days)"),
            PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
            Quantity: $sce.trustAsHtml("Quantit&eacute;"),
            Total: $sce.trustAsHtml("Total"),
            Removed: "FR: Removed",
            Updated: "FR: Updated",
            New: "FR: New",
            YourAttachments: $sce.trustAsHtml("Vos pi&egrave;ces jointes"),
            YourReference: $sce.trustAsHtml("Votre num&eacute;ro de r&eacute;f&eacute;rence; "),
            CommentsHeader: $sce.trustAsHtml("Vos commentaires ou instructions"),
            DeliveryAddress: $sce.trustAsHtml("Adresse de livraison"),
            ViewRevisions: $sce.trustAsHtml("Voir les r&eacute;visions de commande"),
            Save: $sce.trustAsHtml("Sauvegarder"),
	        Share: $sce.trustAsHtml("Partager"),
	        Download: $sce.trustAsHtml("T&eacute;l&eacute;charger"),
	        Print: $sce.trustAsHtml("Imprimer"),
	        Approve: $sce.trustAsHtml("Approuver"),
	        Reject: $sce.trustAsHtml("Rejeter"),
	        Comments: $sce.trustAsHtml("Commentaires"),
	        Status: $sce.trustAsHtml("Statut"),
	        OrderDate: $sce.trustAsHtml("Date de commande"),
	        RejectedMessage: $sce.trustAsHtml("La cotation r&eacute;vis&eacute;e a &eacute;t&eacute; rejet&eacute;e."),
	        RejectedTitle: $sce.trustAsHtml("Cotation mise &agrave; jour"),
	        ApprovedMessage: $sce.trustAsHtml("La cotation r&eacute;vis&eacute;e a &eacute;t&eacute; accept&eacute;e"),
	        ApprovedTitle: $sce.trustAsHtml("Cotation mise &agrave; jour"),
	        Comment: $sce.trustAsHtml("Commentaire"),
	        AddedComment: $sce.trustAsHtml("FR: added a comment - "),
	        Add: $sce.trustAsHtml("Ajouter"),
	        Cancel: $sce.trustAsHtml("Annuler"),
	        PriceDisclaimer: "FR: All prices stated do not include UK VAT or delivery",
	        ReplacementGuidance: "FR: Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
	        POAGuidance: "FR: POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
	        LeadTimeNotice: "FR: Lead time for all orders will be based on the longest lead time from the list of spares requested"
        }
    };
    vm.labels = WeirService.LocaleResources(labels);

	vm.GetFile = function(fileName) {
		var orderid = vm.Quote.xp.OriginalOrderID ? vm.Quote.xp.OriginalOrderID : vm.Quote.ID;
		FilesService.Get(orderid + fileName)
			.then(function(fileData) {
				console.log(fileData);
				var file = new Blob([fileData.Body], {type: fileData.ContentType});
				FileSaver.saveAs(file, fileName);
				//var fileURL = URL.createObjectURL(file);
				//window.open(fileURL, "_blank");
			});
	};

	function _gotoQuotes() {
		if(vm.Quote.xp.Type == "Quote") {
			$state.go("quotes.revised");
		} else {
			$state.go("orders.revised", {filters: JSON.stringify({"xp.Type": "Order","xp.Status": WeirService.OrderStatus.RevisedOrder.id,"xp.Active": true})}, {reload: true});
		}
	}

	function _gotoRevisions() {
		if(vm.Quote.xp.OriginalOrderID) {
			$state.go("revisions", { quoteID: vm.Quote.xp.OriginalOrderID });
		}
	}

	vm.ShowUpdated = function (item) {
		// return true if qty <> xp.originalQty and qty > 0
		if(item.xp) {
			//return (item.xp.OriginalQty && (item.Quantity != item.xp.OriginalQty)) || (item.xp.OriginalUnitPrice && (item.UnitPrice != item.xp.OriginalUnitPrice)) || (item.xp.OriginalLeadTime && (item.Product.xp.LeadTime != item.xp.OriginalLeadTime));
			//return (item.xp.OriginalQty && (item.Quantity != item.xp.OriginalQty)) || (item.xp.OriginalUnitPrice && (item.UnitPrice != item.xp.OriginalUnitPrice)) || (item.xp.OriginalLeadTime && ((item.Product.xp.LeadTime != item.xp.OriginalLeadTime) || (item.xp.LeadTime != item.xp.OriginalLeadTime)));
			return (item.xp.OriginalQty && (item.Quantity != item.xp.OriginalQty)) || (item.xp.OriginalUnitPrice && (item.UnitPrice != item.xp.OriginalUnitPrice)) || (item.xp.OriginalLeadTime && ((item.Product.xp.LeadTime != item.xp.OriginalLeadTime) || (item.xp.LeadTime && item.xp.LeadTime != item.Product.xp.LeadTime )));
		} else {
			return false;
		}
	};

	vm.ShowRemoved = _showRemoved;
	function _showRemoved(line) {
		if(line.xp) {
			return line.Quantity == 0 && line.xp.OriginalQty != 0;
		} else {
			return false;
		}
	}

	vm.ShowNew = _showNew;
	function _showNew(line) {
		if(line.xp) {
			//return line.xp.OriginalQty==0;
			return line.xp.OriginalQty==0 || (vm.Quote.ID.indexOf("Rev") !== -1 && line.xp.OriginalQty==null); //Second part matches items added in admin search.
		} else {
			return false;
		}
	}

	vm.AddNewComment = function() {
		var comment = {
			date: new Date(),
			by: Me.FirstName + " " + Me.LastName,
			val: vm.CommentToWeir
		};
		vm.Quote.xp.CommentsToWeir.push(comment);
		OrderCloud.Orders.Patch(vm.Quote.ID, {xp:{CommentsToWeir: vm.Quote.xp.CommentsToWeir}}, OrderCloud.BuyerID.Get())
			.then(function(order) {
				vm.CommentToWeir = "";
				$state.go($state.current,{}, {reload:true});
			})
			.catch(function(ex) {
				$exceptionHandler(ex);
			})
	};

	function download() {
		$timeout($window.print,1);
	}
	function print() {
		$timeout($window.print,1);
	}
	function getStatusLabel() {
		if (vm.Quote.xp.Status) {
			var status = WeirService.LookupStatus(vm.Quote.xp.Status);
			if (status) {
				return status.label;
				// TODO: Address localization
			}
		}
		return "";
	}
	function _approve() {
		if (vm.Quote.xp.Status == WeirService.OrderStatus.RevisedQuote.id || vm.Quote.xp.Status == WeirService.OrderStatus.RevisedOrder.id) {
			var mods = {
				xp: {
					StatusDate: new Date(),
					Status: vm.Quote.xp.Type == "Quote" ? WeirService.OrderStatus.ConfirmedQuote.id : WeirService.OrderStatus.ConfirmedOrder.id
				}
			};
			WeirService.UpdateQuote(vm.Quote, mods)
				.then(function (qte) {
					toastr.success(vm.labels.ApprovedMessage, vm.labels.ApprovedTitle);
					$state.go('readonly', { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
				});
		}
	}
	function _reject() {
		if (vm.Quote.xp.Status == WeirService.OrderStatus.RevisedQuote.id || vm.Quote.xp.Status == WeirService.OrderStatus.RevisedOrder.id) {
			var mods = {
				xp: {
					StatusDate: new Date(),
					Status: vm.Quote.xp.Type == "Quote" ? WeirService.OrderStatus.RejectedQuote.id : WeirService.OrderStatus.RejectedRevisedOrder.id
				}
			};
			WeirService.UpdateQuote(vm.Quote, mods)
				.then(function (qte) {
					toastr.success(vm.labels.RejectedMessage, vm.labels.RejectedTitle);
					$state.go('readonly', { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
				});
		}
	}
	function _comments() {
		if (vm.Quote.Status == 'RV') {
			console.log("Do something with comments ...");
		}
	}
	function toCsv() {
		return QuoteToCsvService.ToCsvJson(vm.Quote, QuoteShareService.LineItems, vm.ShippingAddress, QuoteShareService.Payments, vm.labels);
	}
	vm.ToCsvJson = toCsv;
	vm.CsvFilename = vm.Quote.ID + ".csv";
	vm.GetImageUrl = function(img) {
		return vm.ImageBaseUrl + img;
	};

    vm.gotoQuotes = _gotoQuotes;
    vm.gotoRevisions = _gotoRevisions;
	vm.Download = download;
	vm.Print = print;
	vm.GetStatusLabel = getStatusLabel;
	vm.Approve = _approve;
	vm.Reject = _reject;
	vm.Comments = _comments;
}

function ModalInstanceController($uibModalInstance, $state, quote, labels) {
	var vm = this;
	vm.quote = quote;
	vm.labels = labels;
	vm.ok = function(navigatePage) {
		if(navigatePage) {
			$uibModalInstance.close();
			$state.go("quotes.saved");
		}
		else {
			$uibModalInstance.close();
		}
	}
}

function MoreQuoteInfoController($uibModalInstance, $state, $sce, WeirService, quote) {
    var vm = this;
    vm.Cancel = cancel;
    vm.Continue = gotoDelivery;

	var vm = this;
	var labels = {
		en: {
		    Title: "You Can Add More Information to this Quote;",
		    Documents: "Add Service Documentation",
		    RefNum: "Add your References",
		    Comments: "Add Comments to your Quote",
		    Continue: "Continue to Delivery Options"
		},
		fr: {
			Title: $sce.trustAsHtml("FR: You can add more information to this quote;"),
		    Documents: $sce.trustAsHtml("FR: add service documentation"),
		    RefNum: $sce.trustAsHtml("FR: add your references"),
		    Comments: $sce.trustAsHtml("FR: add comments to your quote"),
		    Continue: $sce.trustAsHtml("FR: continue to delivery options")
		}
	};
	vm.labels = WeirService.LocaleResources(labels);

    function gotoDelivery() {
		$uibModalInstance.close();
	    if($state.$current.name != "myquote.delivery") {
            $state.go("myquote.delivery");
	    }
    }

    function cancel() {
		$uibModalInstance.close();
	    $state.go("myquote.detail");
    }
}

function NewAddressModalController($uibModalInstance) {
	var vm = this;
	vm.address = {};
	vm.address.xp = {};
	vm.address.xp.active = true;
	vm.address.xp.primary = false;

	vm.submit = function () {
		$uibModalInstance.close(vm.address);
	};

	vm.cancel = function () {
		vm.address = {};
		$uibModalInstance.dismiss('cancel');
	};
}

function SubmitConfirmOrderController($sce, WeirService, Quote) {
	var vm = this;
	vm.Quote = Quote;

	var labels = {
		en: {
			Title: "Thank you. Your order has submitted for review.​",
			MessageText1: "We have sent you a confirmation email.​",
			MessageText2: "We will be in touch with you to discuss the items you have requested to be reviewed.",
			MessageText3: "If your order needs to be revised we will email you an updated quote."
		},
		fr: {
			Title: $sce.trustAsHtml("FR: Thank you. Your order has submitted for review.​"),
			MessageText1: $sce.trustAsHtml("FR: We have sent you a confirmation email.​"),
			MessageText2: $sce.trustAsHtml("FR: We will be in touch with you to discuss the items you have requested to be reviewed."),
			MessageText3: $sce.trustAsHtml("FR: If your order needs to be revised we will email you an updated quote.")
		}
	};
	vm.labels = WeirService.LocaleResources(labels);
}

function SubmitConfirmController($sce, WeirService, Quote, WithPO) {
    var vm = this;
    vm.Quote = Quote;

	var labels = {
		en: {
		    Title: "Thank you. Your order has been placed",
		    MessageText1: "We have sent you a confirmation email.",
		    MessageText2: "Order number; " + Quote.ID,
		    MessageText3: "We will also send you a detailed order confirmation document via email"
		},
		fr: {
		    Title: $sce.trustAsHtml("FR: Thank you. Your order has been placed"),
		    MessageText1: $sce.trustAsHtml("FR: We have sent you a confirmation email."),
		    MessageText2: $sce.trustAsHtml("FR: Order number; " + Quote.ID),
		    MessageText3: $sce.trustAsHtml("FR: We will also send you a detailed order confirmation document via email")
		}
	};

	var labelsPending = {
		en: {
			Title: "Thank you. Your order has been submitted pending your PO.",
			MessageText1: "We have sent you a confirmation email.",
			MessageText2: "When we have received your PO we will confirm your order.",
			MessageText3: "If your order needs to be revised we will email you an updated quote."
		},
		fr: {
			Title: $sce.trustAsHtml("FR: Thank you. Your order has been submitted pending your PO."),
			MessageText1: $sce.trustAsHtml("FR: We have sent you a confirmation email."),
			MessageText2: $sce.trustAsHtml("FR: When we have received your PO we will confirm your order."),
			MessageText3: $sce.trustAsHtml("FR: If your order needs to be revised we will email you an updated quote.")
		}
	};

	if(WithPO) {
		vm.labels = WeirService.LocaleResources(labels);
	} else {
		vm.labels = WeirService.LocaleResources(labelsPending);
	}
}

function ChooseSubmitController($uibModalInstance, $sce, WeirService, QuoteShareService) {
    var vm = this;
    vm.Quote = QuoteShareService.Quote;

    var labels = {
        en: {
            SubmitReview: "Submit quote for review",
            SubmitReviewMessage: $sce.trustAsHtml("<p>Please select Submit quote for review if;<br><br>1. There are items in your quote that you would like Weir to review and confirm.<br>2. You have items in your quote that are POA. Weir will review the quote and provide prices for the POA items.</p>"),
            SubmitReviewBtn: "Submit quote for review",
            ConfirmPO: "Confirm Order",
            ConfirmPOMessage: $sce.trustAsHtml("<p>If you select Confirm Order you will be able to confirm your order as follows;<br><br>1. Submit Order with PO – add your PO number or upload your PO document.<br>2. Submit Order & email PO – submit your order and email your PO (we’ll add it to the order for you).</p>"),
            ConfirmPOBtn: "Confirm Order"
        },
        fr: {
            SubmitReview: $sce.trustAsHtml("Soumettre un devis pour examen"),
            SubmitReviewMessage: $sce.trustAsHtml("<p>Veuillez sélectionner Soumettre un devis pour examen si;<br><br>1. 1. Il y a des articles dans votre devis que vous souhaitez que Weir r&eacute;vise et confirme.<br>2. Vous avez des articles dans votre devis qui sont POA. Weir passera en revue le devis et fournira les prix des articles POA.</p>"),
            SubmitReviewBtn: $sce.trustAsHtml("Soumettre un devis pour examen"),
            ConfirmPO: $sce.trustAsHtml("Confirmer la commande"),
            ConfirmPOMessage: $sce.trustAsHtml("<p>Si vous s&eacute;lectionnez Confirmer la commande, vous pourrez confirmer votre commande comme suit:<br><br> 1.Soumettre l'ordre avec PO - ajoutez votre num&eacute;ro de commande ou t&eacute;l&eacute;chargez votre document de commande. <br><br>2.Soumettre commande & email PO - soumettre votre commande et email votre commande (nous l'ajouterons à la commande pour vous).</p>"),
            ConfirmPOBtn: $sce.trustAsHtml("Confirmer la commande")
        }
    };
    vm.labels = WeirService.LocaleResources(labels);

    function _submitForReview() {
        $uibModalInstance.close("Review");
    }

    function _confirmOrderWithPO() {
        $uibModalInstance.close("Submit");
    }

    vm.submitForReview = _submitForReview;
    vm.confirmOrderWithPO = _confirmOrderWithPO;
}

function QuoteRevisionsController(WeirService, $state, $sce, QuoteID, Revisions) {
    var vm = this;
    vm.Revisions = Revisions;
    vm.QuoteID = QuoteID;

    function getStatusLabel(statusId) {
        if (statusId) {
            var status = WeirService.LookupStatus(statusId);
            if (status) {
                return status.label;
                // TODO: Address localization
            }
        }
        return "";
    }
    function view(quote) {
    	// Catch orders that are despatched, invoiced, or confirmed. they are read only
        if (quote.xp.Active && quote.xp.Status != WeirService.OrderStatus.Despatched.id && quote.xp.Status != WeirService.OrderStatus.Invoiced.id && quote.xp.Status != WeirService.OrderStatus.ConfirmedOrder.id) {
            // ToDo TEST: Current order should be this one. No altering revised quotes.
	        $state.go("revised", {quoteID: quote.ID, buyerID: quote.xp.BuyerID});
        } else {
            $state.go("readonly", { quoteID: quote.ID, buyerID: quote.xp.BuyerID });
        }
    }

    var labels = {
        en: {
            QuoteHeading: "Quote revisions for Quote; " + vm.QuoteID,
            Instructions1: "Select 'view' to view previous revisions for reference",
            Instructions2: "You can view and comment on the current revision",
            SearchQuotes: "Search Quotes",
            Search: "Search",
            QuoteID: "Quote ID",
            CustomerRef: "Customer Ref",
            BusinessName: "Business Name",
            SubmittedBy: "Submitted By",
            QuoteValue: "Quote Value",
            DateRevised: "Date Revised",
            Reviewer: "Reviewer",
            Status: "Status",
            View: "View",
            LoadMore: "Load More"
        },
        fr: {
            QuoteHeading: $sce.trustAsHtml("FR: Quote revisions for Quote; " + QuoteID),
            Instructions1: $sce.trustAsHtml("FR: Select 'view' to view previous revisions for reference"),
            Instructions2: $sce.trustAsHtml("FR: You can view and comment on the current revision"),
            SearchQuotes: $sce.trustAsHtml("FR: Search Quotes"),
            Search: $sce.trustAsHtml("Rechercher"),
            QuoteID: $sce.trustAsHtml("FR: Quote ID"),
            CustomerRef: $sce.trustAsHtml("FR: Customer Ref"),
            BusinessName: $sce.trustAsHtml("FR: Business Name"),
            SubmittedBy: $sce.trustAsHtml("FR: Submitted by"),
            QuoteValue: $sce.trustAsHtml("FR: Quote value"),
            DateRevised: $sce.trustAsHtml("FR: Date Revised"),
            Reviewer: $sce.trustAsHtml("FR: Reviewer"),
            Status: $sce.trustAsHtml("Statut"),
            View: $sce.trustAsHtml("FR: View")
        }
    };
    vm.labels = WeirService.LocaleResources(labels);
    vm.GetStatusLabel = getStatusLabel;
    vm.View = view;
}

function ReadonlyQuoteController($sce, $state, WeirService, $timeout, $window, Quote, ShippingAddress, LineItems, PreviousLineItems, Payments,
                                 imageRoot, OCGeography, Underscore, QuoteToCsvService, Me, fileStore, OrderCloud, FilesService, FileSaver) {
    var vm = this;
	vm.fileStore = fileStore;
	vm.ImageBaseUrl = imageRoot;
	vm.Zero = 0;
    vm.Quote = Quote;
    vm.ShippingAddress = ShippingAddress;
    vm.LineItems = LineItems ? LineItems.Items : [];
	vm.BuyerID = OrderCloud.BuyerID.Get();
	if(PreviousLineItems) {
		vm.PreviousLineItems = Underscore.filter(PreviousLineItems.Items, function (item) {
			if (Underscore.findWhere(LineItems.Items, {ProductID: item.ProductID})) {
				return;
			} else {
				return item;
			}
		});
	} else {
		vm.PreviousLineItems = [];
	}
    vm.Payments = Payments.Items;
	vm.country = function (c) {
		var result = Underscore.findWhere(OCGeography.Countries, { value: c });
		return result ? result.label : '';
	};
    var labels = {
        en: {
            Customer: "Customer; ",
            QuoteNumber: "Quote Number; ",
            QuoteName: "Quote Name; ",
            SerialNum: "Serial Number",
            TagNum: "Tag Number (if available)",
            PartNum: "Part Number",
            PartDesc: "Description of Part",
            RecRepl: "Recommended Replacement",
            LeadTime: "Lead Time",
            PricePer: "Price per Item or Set",
            Quantity: "Quantity",
            Total: "Total",
            YourAttachments: "Your Attachments",
            YourReference: "Your Reference No; ",
            CommentsHeader: "Your Comments or Instructions",
            DeliveryOptions: "Delivery Options",
            DeliveryAddress: "Delivery Address",
            WeirComment: "Comment",
	        Save: "Save",
	        Share: "Share",
	        Download: "Download",
	        Print: "Print",
	        Approve: "Approve",
	        Reject: "Reject",
	        Comments: "Comments",
	        Status: "Status",
	        OrderDate: "Order Date;",
	        BackToQuotes: "Back to your Quotes",
	        SubmitWithPO: "Submit Order",
	        PriceDisclaimer: "All prices stated do not include UK VAT or delivery",
	        ViewRevisions: "View Previous Revisions",
	        ReplacementGuidance: "Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
	        POAGuidance: "POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
	        LeadTimeNotice: "Lead time for all orders will be based on the longest lead time from the list of spares requested"
        },
        fr: {
            Customer: $sce.trustAsHtml("Client "),
            QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation "),
            QuoteName: $sce.trustAsHtml("Nom de la cotation "),
            SerialNum: $sce.trustAsHtml("Num&eacute;ro de S&eacute;rie"),
            TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
            PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
            PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
            RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute;"),
            LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison"),
            PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
            Quantity: $sce.trustAsHtml("Quantit&eacute;"),
            Total: $sce.trustAsHtml("Total"),
            YourAttachments: $sce.trustAsHtml("Vos pi&egrave;ces jointes"),
            YourReference: $sce.trustAsHtml("Votre num&eacute;ro de r&eacute;f&eacute;rence; "),
            CommentsHeader: $sce.trustAsHtml("Vos commentaires ou instructions"),
            DeliveryOptions: $sce.trustAsHtml("Options de livraison"),
            DeliveryAddress: $sce.trustAsHtml("Adresse de livraison"),
            WeirComment: $sce.trustAsHtml("Commenter"),
            Save: $sce.trustAsHtml("Sauvegarder"),
	        Share: $sce.trustAsHtml("Partager"),
	        Download: $sce.trustAsHtml("T&eacute;l&eacute;charger"),
	        Print: $sce.trustAsHtml("Imprimer"),
	        Approve: $sce.trustAsHtml("Approuver"),
	        Reject: $sce.trustAsHtml("Rejeter"),
	        Comments: $sce.trustAsHtml("Commentaires"),
	        Status: $sce.trustAsHtml("Statut"),
	        OrderDate: $sce.trustAsHtml("Date de commande;"),
	        BackToQuotes: $sce.trustAsHtml("Retour &agrave; vos devis"),
	        SubmitWithPO: $sce.trustAsHtml("Soumettre une commande avec bon de commande"),
	        PriceDisclaimer: $sce.trustAsHtml("FR: All prices stated do not include UK VAT or delivery"),
	        ViewRevisions: $sce.trustAsHtml("Voir les r&eacute;visions de commande"),
	        ReplacementGuidance: "FR: Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
	        POAGuidance: "FR: POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
	        LeadTimeNotice: "FR: Lead time for all orders will be based on the longest lead time from the list of spares requested"
        }
    };
    vm.labels = WeirService.LocaleResources(labels);

	vm.GetFile = function(fileName) {
		var orderid = vm.Quote.xp.OriginalOrderID ? vm.Quote.xp.OriginalOrderID : vm.Quote.ID;
		FilesService.Get(orderid + fileName)
			.then(function(fileData) {
				console.log(fileData);
				var file = new Blob([fileData.Body], {type: fileData.ContentType});
				FileSaver.saveAs(file, fileName);
				//var fileURL = URL.createObjectURL(file);
				//window.open(fileURL, "_blank");
			});
	};

	vm.ToCsvJson = toCsv;
	vm.CsvFilename = vm.Quote.ID + ".csv";
	vm.GetImageUrl = function(img) {
		return vm.ImageBaseUrl + img;
	};
	function download() {
		$timeout($window.print,1);
	}
	function print() {
		$timeout($window.print,1);
	}
	function getStatusLabel() {
		if (vm.Quote.xp.Status) {
			var status = WeirService.LookupStatus(vm.Quote.xp.Status);
			if (status) {
				return status.label;
				// TODO: Address localization
			}
		}
		return "";
	}
	function toCsv() {
		return QuoteToCsvService.ToCsvJson(vm.Quote, vm.LineItems, vm.ShippingAddress, vm.Payments, vm.labels);
	}

	function _gotoQuotes() {
		if(vm.Quote.xp.Type == "Quote") {
			$state.go("quotes.revised");
		} else {
			$state.go("orders.revised", {filters: JSON.stringify({"xp.Type": "Order","xp.Status": WeirService.OrderStatus.RevisedOrder.id,"xp.Active": true})}, {reload: true});
		}
	}

	function _gotoRevisions() {
		if(vm.Quote.xp.OriginalOrderID) {
			$state.go("revisions", { quoteID: vm.Quote.xp.OriginalOrderID });
		}
	}

	vm.Download = download;
	vm.Print = print;
	vm.GetStatusLabel = getStatusLabel;
	vm.gotoQuotes = _gotoQuotes;
	vm.gotoRevisions = _gotoRevisions;
}

function SubmitController($sce, toastr, WeirService, $timeout, $window, $uibModal, $state, Quote, ShippingAddress, LineItems,
                          PreviousLineItems, Payments, imageRoot, OCGeography, Underscore, OrderCloud, Me, FilesService, FileSaver) {
	var vm = this;
	vm.NewComment = null;
	vm.ImageBaseUrl = imageRoot;
	vm.Zero = 0;
	vm.PONumber = "";
	vm.Quote = Quote;
	vm.ShippingAddress = ShippingAddress;
	vm.LineItems = LineItems ? LineItems.Items : [];
	vm.BuyerID = OrderCloud.BuyerID.Get();
	if(PreviousLineItems) {
		vm.PreviousLineItems = Underscore.filter(PreviousLineItems.Items, function (item) {
			if (Underscore.findWhere(LineItems.Items, {ProductID: item.ProductID})) {
				return;
			} else {
				return item;
			}
		});
	} else {
		vm.PreviousLineItems = [];
	}
	vm.Payments = Payments.Items;
	var payment = (vm.Payments.length > 0) ? vm.Payments[0] : null;
	if (payment && payment.xp && payment.xp.PONumber) vm.PONumber = payment.xp.PONumber;
	vm.country = function (c) {
		var result = Underscore.findWhere(OCGeography.Countries, { value: c });
		return result ? result.label : '';
	};
	var labels = {
		en: {
			Customer: "Customer; ",
			QuoteNumber: "Quote Number; ",
			QuoteName: "Quote Name; ",
			SerialNum: "Serial Number",
			TagNum: "Tag Number (if available)",
			PartNum: "Part Number",
			PartDesc: "Description of Part",
			RecRepl: "Recommended Replacement",
			LeadTime: "Lead Yime",
			PricePer: "Price per Item or Set",
			Quantity: "Quantity",
			Total: "Total",
			YourAttachments: "Your Attachments",
			YourReference: "Your Reference No; ",
			CommentsHeader: "Your Comments or Instructions",
			DeliveryOptions: "Delivery Options",
			DeliveryAddress: "Delivery Address",
			WeirComment: "Comment",
			Save: "Save",
			Share: "Share",
			Download: "Download",
			Print: "Print",
			Approve: "Approve",
			Reject: "Reject",
			Comments: "Comments",
			Status: "Status",
			OrderDate: "Order Date;",
			BackToQuotes: "Back to your Quotes",
			SubmitWithPO: "Submit Order",
			SubmitOrderAndEmail: "Submit Order & Email PO",
			SubmitOrderWithPO: "Submit Order",
			EmailPoMessage: "*Your order will be confirmed<br class='message-break'>following receipt of your PO.",
			POEntry: "Enter PO Number",
			PriceDisclaimer: "All prices stated do not include UK VAT or delivery",
			DragAndDrop: "Drag and drop Files Here to Upload",
			PONeededHeader: "Please Provide a Purchase Order to Finalise your Order",
			POUpload: "Upload PO Document",
			ReplacementGuidance: "Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
			POAGuidance: "POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
			LeadTimeNotice: "Lead time for all orders will be based on the longest lead time from the list of spares requested",
			Add: "Add",
			Cancel: "Cancel",
			AddedComment: " added a comment - "
		},
		fr: {
			Customer: $sce.trustAsHtml("Client "),
			QuoteNumber: $sce.trustAsHtml("Num&eacute;ro de cotation "),
			QuoteName: $sce.trustAsHtml("Nom de la cotation "),
			SerialNum: $sce.trustAsHtml("Num&eacute;ro de S&eacute;rie"),
			TagNum: $sce.trustAsHtml("Num&eacute;ro de Tag"),
			PartNum: $sce.trustAsHtml("R&eacute;f&eacute;rence de la pi&egrave;ce"),
			PartDesc: $sce.trustAsHtml("Description de la pi&egrave;ce"),
			RecRepl: $sce.trustAsHtml("Remplacement recommand&eacute;"),
			LeadTime: $sce.trustAsHtml("D&eacute;lai de livraison"),
			PricePer: $sce.trustAsHtml("Prix par item ou par kit"),
			Quantity: $sce.trustAsHtml("Quantit&eacute;"),
			Total: $sce.trustAsHtml("Total"),
			YourAttachments: $sce.trustAsHtml("Vos pi&egrave;ces jointes"),
			YourReference: $sce.trustAsHtml("Votre num&eacute;ro de r&eacute;f&eacute;rence; "),
			CommentsHeader: $sce.trustAsHtml("Vos commentaires ou instructions"),
			DeliveryOptions: $sce.trustAsHtml("Options de livraison"),
			DeliveryAddress: $sce.trustAsHtml("Adresse de livraison"),
			WeirComment: $sce.trustAsHtml("Commenter"),
			Save: $sce.trustAsHtml("Sauvegarder"),
			Share: $sce.trustAsHtml("Partager"),
			Download: $sce.trustAsHtml("T&eacute;l&eacute;charger"),
			Print: $sce.trustAsHtml("Imprimer"),
			Approve: $sce.trustAsHtml("Approuver"),
			Reject: $sce.trustAsHtml("Rejeter"),
			Comments: $sce.trustAsHtml("Commentaires"),
			Status: $sce.trustAsHtml("Statut"),
			OrderDate: $sce.trustAsHtml("Date de commande;"),
			BackToQuotes: $sce.trustAsHtml("Retour &agrave; vos devis"),
			SubmitWithPO: $sce.trustAsHtml("Soumettre une commande avec bon de commande"),
			SubmitOrderAndEmail: $sce.trustAsHtml("Soumettre une commande & E-Mail de pi&egrave;ce de rechange"),
			SubmitOrderWithPO: $sce.trustAsHtml("Soumettre une commande avec bon de commande"),
			EmailPoMessage: $sce.trustAsHtml("FR: Your order will be confirmed<br class='message-break'>following receipt of your PO."),
			POEntry: $sce.trustAsHtml("Entrer une r&eacute;f&eacute;rence de commande"),
			PriceDisclaimer: $sce.trustAsHtml("FR: All prices stated do not include UK VAT or delivery"),
			DragAndDrop: $sce.trustAsHtml("Faites glisser vos documents ici pour les t&eacute;l&eacute;charger"),
			PONeededHeader: $sce.trustAsHtml("Veuillez fournir un bon de commande pour finaliser votre commande"),
			POUpload: $sce.trustAsHtml("T&eacute;l&eacute;charger le bon de commande"),
			ReplacementGuidance: "Recommended replacement guidance; If ordering 5 year spares you should also order all 2 year spares. If ordering 10 year spares, you should also order all 5 year and 2 year spares.",
			POAGuidance: "POA; You can add POA items to your quote and submit your quote for review. We will respond with a price for the POA items on your quote request.",
			LeadTimeNotice: "Lead time for all orders will be based on the longest lead time from the list of spares requested",
			Add: "Add",
			Cancel: "Cancel",
			AddedComment: " added a comment - "
		}
	};
	vm.labels = WeirService.LocaleResources(labels);

	vm.AddNewComment = function() {
		if (vm.NewComment) {
			var comment = {
				date: new Date(),
				by: Me.Profile.FirstName + " " + Me.Profile.LastName,
				val: vm.NewComment
			};

			// Take the new comment, push it onto the current comments to weir then patch.
			if (!vm.Quote.xp.CommentsToWeir || Object.prototype.toString.call(vm.Quote.xp.CommentsToWeir) !== '[object Array]') {
				vm.Quote.xp.CommentsToWeir = [];
			}
			vm.Quote.xp.CommentsToWeir.push(comment);
			OrderCloud.Orders.Patch(vm.Quote.ID, {xp: {CommentsToWeir: vm.Quote.xp.CommentsToWeir}})
				.then(function (quote) {
					vm.Quote = quote;
				});
			vm.NewComment = null; //BE SURE TO DO THIS IN THE CHILD CONTROLLER
		} else {
			toastr.info("Cannot save an empty comment.","Empty Comment");
		}
	};

	vm.GetFile = function(fileName) {
		var orderid = vm.Quote.xp.OriginalOrderID ? vm.Quote.xp.OriginalOrderID : vm.Quote.ID;
		FilesService.Get(orderid + fileName)
			.then(function(fileData) {
				console.log(fileData);
				var file = new Blob([fileData.Body], {type: fileData.ContentType});
				FileSaver.saveAs(file, fileName);
			});
	};

	vm.ToCsvJson = toCsv;
	vm.CsvFilename = vm.Quote.ID + ".csv";
	vm.GetImageUrl = function(img) {
		return vm.ImageBaseUrl + img;
	};

	function download() {
		$timeout($window.print,1);
	}
	function print() {
		$timeout($window.print,1);
	}
	function getStatusLabel() {
		if (vm.Quote.xp.Status) {
			var status = WeirService.LookupStatus(vm.Quote.xp.Status);
			if (status) {
				return status.label;
				// TODO: Address localization
			}
		}
		return "";
	}
	function toCsv() {
		return QuoteToCsvService.ToCsvJson(vm.Quote, QuoteShareService.LineItems, vm.ShippingAddress, QuoteShareService.Payments, vm.labels);
	}
	function _gotoQuotes() {
		if(vm.Quote.xp.Type == "Quote") {
			$state.go("quotes.revised");
		} else {
			$state.go("orders.revised");
		}
	}
	// ToDo Accept a parameter withPO. It will be true or false.
	function _submitOrder(withPO) {
		if (payment == null) {
			if (vm.PONumber) {
				var data = {
					Type: "PurchaseOrder",
					xp: {
						PONumber: vm.PONumber
					}
				};
				OrderCloud.Payments.Create(vm.Quote.ID, data, OrderCloud.BuyerID.Get())
					.then(function (pmt) {
						vm.Payments.push(pmt);
						payment = pmt;
						completeSubmit(withPO);
					})
			} else {
				// email the PO later. Can we acutally submit without a PO?
				completeSubmit(withPO);
			}
		} else if (!payment.xp || payment.xp.PONumber != vm.PONumber) {
			var data = {
				xp: {
					PONumber: vm.PONumber
				}
			};
			OrderCloud.Payments.Patch(vm.Quote.ID, payment.ID, data, OrderCloud.BuyerID.Get())
				.then(function (pmt) {
					vm.Payments[0] = pmt;
					payment = pmt;
					completeSubmit(withPO);
				})
		} else {
			completeSubmit(withPO);
		}
	}
	function completeSubmit(withPO) {
		var data = {};
		if(withPO) {
			data = {
				xp: {
					Status: WeirService.OrderStatus.SubmittedWithPO.id,
					StatusDate: new Date(),
					Type: "Order",
					Revised: false,
					PONumber: vm.PONumber,
					PendingPO: false
				}
			};
		} else {
			data = {
				xp: {
					Status: WeirService.OrderStatus.SubmittedPendingPO.id,
					StatusDate: new Date(),
					Type: "Order",
					PendingPO: true,
					PONumber: "Pending",
					Revised: false
				}
			};
		}
		WeirService.UpdateQuote(vm.Quote, data)
			.then(function (info) {
				var modalInstance = $uibModal.open({
					animation: true,
					ariaLabelledBy: 'modal-title',
					ariaDescribedBy: 'modal-body',
					templateUrl: 'myquote/templates/myquote.orderplacedconfirm.tpl.html',
					size: 'lg',
					controller: 'SubmitConfirmCtrl',
					controllerAs: 'submitconfirm',
					resolve: {
						Quote: function () {
							return vm.Quote;
						},
						WithPO: function() {
							return withPO;
						}
					}
				}).closed.then(function () {
					$state.go('readonly', { quoteID: vm.Quote.ID, buyerID: OrderCloud.BuyerID.Get() });
				});
			});
	}

	vm.Download = download;
	vm.Print = print;
	vm.GetStatusLabel = getStatusLabel;
	vm.gotoQuotes = _gotoQuotes;
	vm.submitOrder = _submitOrder;
}