/*
 * [y] hybris Platform
 *
 * Copyright (c) 2000-2014 hybris AG
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of hybris
 * ("Confidential Information"). You shall not disclose such Confidential
 * Information and shall use it only in accordance with the terms of the
 * license agreement you entered into with hybris.
 */

describe('CartSvc Test', function () {

    var mockBackend, $scope, $rootScope, cartSvc, siteConfig, cartUrl, productUrl, mockedGlobalData = {};
    var cartId = 'cartId456';
    var prodId = '123';
    var prod1 = {
        product: {
            name: 'Electric Guitar',
            id: prodId,
            mixins: {
                inventory: {
                    inStock: false
                }
            }
        },
        categories: [
            {
                id: 12345,
                name: 'fakeCat',
                slug: 'fake-cat'
            }
        ],
        prices: [{
            effectiveAmount: 5.00,
            currency: 'USD'
        }]
    };
    var itemId = '0';
    var productIdFromCart = '540751ee394edbc101ff20f5';
    var mockedAccountSvc = {};

    var mockedState = {
        current: 'base.checkout',
        go: jasmine.createSpy(),
        transitionTo: jasmine.createSpy()
    };

    var deferredAccount;
    var cartResponse = {
        "items": [{
            "id": "0",
            "price": {
                "currency": "USD",
                "effectiveAmount": 10.67
            },
            "product": {
                "id": productIdFromCart,
                "inStock": false
            },
            "totalItemPrice": {
                "currency": "USD",
                "amount": 10.67
            },
            "quantity": 1.0
        }],
        "currency": "USD"
    };


    //***********************************************************************
    // Common Setup
    // - shared setup between constructor validation and method validation
    //***********************************************************************

    beforeEach(function () {
        module('restangular');
        module('ds.products');
        module('ds.cart', function ($provide) {
            $provide.value('AccountSvc', mockedAccountSvc);
            $provide.value('GlobalData', mockedGlobalData);
            $provide.value('appConfig', {});
            $provide.value('$state', mockedState);
            $provide.value('$stateParams', {});
        });


        this.addMatchers({
            toEqualData: function (expected) {
                return angular.equals(this.actual, expected);
            },

            toBeInError: function (expected) {
                return expected.error;
            }
        });
    });

    beforeEach(inject(function (_$httpBackend_, _$rootScope_, _$q_, CartSvc, SiteConfigSvc) {

        $rootScope = _$rootScope_;
        $scope = _$rootScope_.$new();
        mockBackend = _$httpBackend_;
        cartSvc = CartSvc;
        siteConfig = SiteConfigSvc;
        cartUrl = siteConfig.apis.cart.baseUrl + 'carts';
        productUrl = siteConfig.apis.products.baseUrl + 'products'
        mockBackend.whenGET(/^[A-Za-z-/]*\.html/).respond({});
        deferredAccount = _$q_.defer();
        mockedAccountSvc.getCurrentAccount = jasmine.createSpy('getCurrentAccount').andReturn(deferredAccount.promise);
        deferredAccount.resolve({ id: 'abc', customerNumber: '123' });
        $scope.$apply();
        this.addMatchers({
            toEqualData: function (expected) {
                return angular.equals(this.actual, expected);
            }
        });
        mockedGlobalData.getCurrencyId = jasmine.createSpy('getCurrencyId').andReturn('USD');
        mockedGlobalData.getAcceptLanguages = jasmine.createSpy('getAcceptLanguages').andReturn('en');
    }));

    describe('getLocalCart', function () {
        it('should return cart', function () {
            var cart = cartSvc.getLocalCart();
            expect(cart).toBeTruthy();
        });
    });

    describe('addProductToCart - new cart', function () {
        it('should create new cart, create cart item and GET new cart', function () {
            mockBackend.expectPOST(cartUrl).respond({
                "cartId": cartId
            });

            mockBackend.expectPOST(cartUrl + '/' + cartId + '/items', {
                "product": { "id": prodId }, "price": { "effectiveAmount": 5, "currency": "USD" }, "quantity": 2
            })
                .respond(201, {});

            var cartPromise = cartSvc.addProductToCart(prod1.product, prod1.prices, 2, {});
            var successSpy = jasmine.createSpy();
            cartPromise.then(successSpy);

            mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, cartResponse);
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + productIdFromCart + ')').respond(200, [{ id: prodId, images: ['myurl'] }]);
            mockBackend.flush();

            expect(successSpy).wasCalled();
        });

        it('should return failing promise if cart POST fails', function () {
            mockBackend.expectPOST(cartUrl).respond(500, {});

            var cartPromise = cartSvc.addProductToCart(prod1.product, prod1.prices, 2, {});
            var failureSpy = jasmine.createSpy();
            cartPromise.then(function () { }, failureSpy);

            mockBackend.flush();
            expect(failureSpy).wasCalled();
        });

        it('should return failing promise if cart item POST fails', function () {
            mockBackend.expectPOST(cartUrl).respond({
                "cartId": cartId
            });
            mockBackend.expectPOST(cartUrl + '/' + cartId + '/items', { "product": { "id": prodId }, "price": { "effectiveAmount": 5, "currency": "USD" }, "quantity": 2 })
                .respond(500, {});

            var cartPromise = cartSvc.addProductToCart(prod1.product, prod1.prices, 2, {});
            var failureSpy = jasmine.createSpy();
            cartPromise.then(function () { }, failureSpy);
            mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, cartResponse);
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + productIdFromCart + ')').respond(200, [{ id: prodId, images: ['myurl'] }]);
            mockBackend.flush();
            expect(failureSpy).wasCalled();
        });


    });


    describe('<<existing cart>>', function () {
        beforeEach(function () {
            mockBackend.expectPOST(cartUrl).respond({
                "cartId": cartId
            });
            mockBackend.expectPOST(cartUrl + '/' + cartId + '/items', { "product": { "id": prodId }, "price": { "effectiveAmount": 5, "currency": "USD" }, "quantity": 2 })
                .respond(201, {});
            cartSvc.addProductToCart(prod1.product, prod1.prices, 2, {});
            mockBackend.expectGET(cartUrl + '/' + cartId).respond(200,
                {
                    "currency": "USD",
                    "subTotalPrice": {
                        "currency": "USD",
                        "amount": 10.00
                    },
                    "totalUnitsCount": 1.0,
                    "customerId": "39328def-2081-3f74-4004-6f35e7ee022f",
                    "items": [
                        {
                            "product": {
                                "sku": "sku1",
                                "description": "desc",
                                "id": prodId,
                                "name": "Electric Guitar",
                                "inStock": false
                            },
                            "price": {
                                "currency": "USD",
                                "effectiveAmount": 5.00
                            },
                            "id": itemId,
                            "quantity": 2.0
                        }
                    ],
                    "totalPrice": {
                        "currency": "USD",
                        "amount": 13.24
                    },
                    "id": cartId,
                    "shippingCost": {
                        "currency": "USD",
                        "amount": 3.24
                    }
                });
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(123)').respond(200, [{ id: prodId, images: ['myurl'] }]);
            mockBackend.flush();
            var updatedCart = cartSvc.getLocalCart();
            expect(updatedCart.items.length).toEqualData(1);

        });

        describe('addProductToCart()', function () {

            it('should update qty of existing cart item if already in cart', function () {
                var updatedCart = cartSvc.getLocalCart();
                expect(updatedCart.items.length).toEqualData(1);
                mockBackend.expectPUT(cartUrl + '/' + cartId + '/items/' + itemId, { "product": { "id": prodId }, "price": { "currency": "USD", "effectiveAmount": 5 }, "quantity": 3 })
                    .respond(201, {});
                mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, cartResponse);
                mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + productIdFromCart + ')').respond(200, [{ id: prodId, images: ['myurl'] }]);

                console.log(prod1.product);
                
                var promise = cartSvc.addProductToCart(prod1.product, prod1.prices, 1, {});
                var successSpy = jasmine.createSpy();
                promise.then(successSpy);
                mockBackend.flush();
                expect(successSpy).wasCalled();
            });

            it('should return rejected promise if update fails', function () {
                mockBackend.expectPUT(cartUrl + '/' + cartId + '/items/' + itemId, { "product": { "id": prodId }, "price": { "currency": "USD", "effectiveAmount": 5 }, "quantity": 3 })
                    .respond(500, {});
                var promise = cartSvc.addProductToCart(prod1.product, prod1.prices, 1, {});
                var failureSpy = jasmine.createSpy();
                promise.then(function () { }, failureSpy);
                mockBackend.flush();
                expect(failureSpy).wasCalled();
            });

            it('should return promise if attempting update with qty = 0', function () {
                var promise = cartSvc.addProductToCart(prod1.product, prod1.prices, 0, {});
                $scope.$apply();
                expect(promise).toBeTruthy();
                expect(promise.then).toBeTruthy();
            });
        });

        describe('removeProductFromCart()', function () {
            it('should delete cart item', function () {
                mockBackend.expectDELETE(cartUrl + '/' + cartId + '/items/' + itemId).respond(200, {});
                mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, cartResponse);
                mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + productIdFromCart + ')').respond(200, [{ id: prodId, images: ['myurl'] }]);
                cartSvc.removeProductFromCart(itemId);
                mockBackend.flush();
            });

            it('should set item error if delete fails', function () {
                mockBackend.expectDELETE(cartUrl + '/' + cartId + '/items/' + itemId).respond(500, {});
                cartSvc.removeProductFromCart(itemId);
                mockBackend.flush();
                expect(cartSvc.getLocalCart().items[0].error).toBeTruthy();
            });
        });

        describe('updateCartItem()', function () {
            it('should update cart item if qty > 0', function () {
                var item = cartSvc.getLocalCart().items[0];
                mockBackend.expectPUT(cartUrl + '/' + cartId + '/items/' + itemId, { "product": { "id": prodId}, "price": { "currency": "USD", "effectiveAmount": 5 }, "quantity": 5 })
                    .respond(201, {});
                mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, cartResponse);
                mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + productIdFromCart + ')').respond(200, [{ id: prodId, images: ['myurl'] }]);
                cartSvc.updateCartItem(item, 5, {});
                mockBackend.flush();
            });

            it('should issue no calls if qty < 1', function () {
                var item = cartSvc.getLocalCart().items[0];
                cartSvc.updateCartItem(item, 0, {});
                mockBackend.verifyNoOutstandingRequest();
            });

            it('should set item error if update fails', function () {
                var item = cartSvc.getLocalCart().items[0];
                mockBackend.expectPUT(cartUrl + '/' + cartId + '/items/' + itemId, { "product": { "id": prodId}, "price": { "currency": "USD", "effectiveAmount": 5 }, "quantity": 5 })
                    .respond(500, {});
                cartSvc.updateCartItem(item, 5, {});
                mockBackend.flush();
                expect(cartSvc.getLocalCart().items[0].error).toBeTruthy();
            });
        });

        describe('resetCart', function () {
            it('should create an empty cart', function () {
                cartSvc.resetCart();
                expect(cartSvc.getLocalCart().items.length).toBeFalsy();
            });
        });

        describe('switchCurrency', function () {
            var eventSpy;

            beforeEach(function () {
                eventSpy = spyOn($rootScope, '$emit');
                mockedGlobalData.getCurrencyId = jasmine.createSpy('getCurrencyId').andReturn("EUR");
            });

            it('should switch the cart currency', function () {
                mockBackend.expectPOST(cartUrl + '/' + cartId + '/changeCurrency', { "currency": "EUR" })
                    .respond(200, {});
                mockBackend.expectGET(cartUrl + '/' + cartId).respond(200,
                    {

                        "id": cartId,
                        "items": [
                            {
                                "product": {

                                    "id": prodId
                                },
                                "price": {
                                    "currency": "USD",
                                    "effectiveAmount": 5.00
                                },
                                "id": itemId
                            }
                        ],
                        "currency": "EUR"
                    });
                mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + prodId + ')').respond(200, [{ id: prodId, images: ['myurl'], name: 'name' }]);
                cartSvc.switchCurrency('EUR');
                mockBackend.flush();
                var closeAfterTimeout;
                expect($rootScope.$emit).toHaveBeenCalledWith('cart:updated', { cart: { currency: 'EUR', id: 'cartId456', items: [{ product: { id: '123', name: 'name' }, price: { currency: 'USD', effectiveAmount: 5 }, id: '0', images: undefined }] }, source: 'currency', closeAfterTimeout: closeAfterTimeout });
            });

            it('should signal cart error on currency switch failure', function () {

                mockBackend.expectPOST(cartUrl + '/' + cartId + '/changeCurrency', { "currency": "EUR" })
                    .respond(500, {});
                cartSvc.switchCurrency('EUR');
                mockBackend.flush();
                expect($rootScope.$emit).toHaveBeenCalled();

                expect(eventSpy.mostRecentCall.args[1].cart.error).toBeTruthy();
            });
        });



    });

    describe('refreshCartAfterLogin() - customer has cart', function () {

        var custId = 'abc';

        beforeEach(function () {

        });

        it('should get the cart for the customer', function () {
            // no anonymous cart - initialize to blank cart
            mockBackend.expectGET(cartUrl).respond(404, {});
            cartSvc.getCart();
            mockBackend.flush();

            // should get cart for customer
            mockBackend.expectGET(cartUrl + '?customerId=' + custId).respond(200, {
                "currency": "USD",
                "items": [
                {
                    "product": {
                        "id": prodId
                    },
                    "price": {
                        "currency": "USD",
                        "effectiveAmount": 5.00
                    },
                    "id": itemId,
                    "quantity": 2.0
                }
                ],
                "id": cartId
            });
            // should query product info for cart
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(123)').respond(500, {});
        });

        it('should merge the cart if there was an anonymous cart with items', function () {
            var anonCartId = 'anon123';
            var prodId2 = 'prod2';
            // Set existing anonymous cart in CartSvc scope:
            // should query anonymous cart - with items:
            mockBackend.expectGET(cartUrl).respond(200, {
                "currency": "USD",
                "items": [
                    {
                        "product": {
                            "id": prodId2
                        },
                        "price": {
                            "currency": "USD",
                            "effectiveAmount": 5.00
                        },
                        "id": 'zsd458',
                        "quantity": 2.0
                    }
                ],
                "id": anonCartId
            });
            // should query product info for anonymous cart
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(' + prodId2 + ')').respond(500, {});
            cartSvc.getCart();
            mockBackend.flush();

            ////////////////////////////
            // Actual test setup

            // should get cart for customer
            mockBackend.expectGET(cartUrl + '?customerId=' + custId).respond(200, {
                "currency": "USD",
                "items": [
                    {
                        "product": {
                            "id": prodId
                        },
                        "price": {
                            "currency": "USD",
                            "effectiveAmount": 5.00
                        },
                        "id": itemId,
                        "quantity": 2.0
                    }
                ],
                "id": cartId
            });

            // should issue merge request https://yaas-test.apigee.net/test/cart/v3/carts/cartId456/merge
            mockBackend.expectPOST(cartUrl + '/' + cartId + '/merge', { "carts": [anonCartId] }).respond(200, {});
            // should refresh current cart
            mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, { currency: 'USD' });
            // should query product info for items in shopper cart
            mockBackend.whenGET(productUrl + '?expand=media&q=id:(' + prodId + ')').respond(500, {});
            cartSvc.refreshCartAfterLogin(custId);
            mockBackend.flush();
        });

        it('should switch cart currency if customer cart currency different than current store currency', function () {
            // should query for anonymous cart - assume not found:
            mockBackend.expectGET(cartUrl).respond(404, {});
            cartSvc.getCart();
            mockBackend.flush();

            // should get cart for customer - note different currency
            mockBackend.expectGET(cartUrl + '?customerId=' + custId).respond(200, {
                "currency": "EUR",
                "items": [
                    {
                        "product": {
                            "id": prodId
                        },
                        "price": {
                            "currency": "USD",
                            "effectiveAmount": 5.00
                        },
                        "id": itemId,
                        "quantity": 2.0
                    }
                ],
                "id": cartId
            });

            mockBackend.whenGET(productUrl + '?expand=media&q=id:(' + prodId + ')').respond(500, {});

            // should issue changeCurrency request
            mockBackend.expectPOST(cartUrl + '/' + cartId + '/changeCurrency').respond(204, {});

            // should refresh current cart - fake currency to match global data so second currency change won't be triggered
            mockBackend.expectGET(cartUrl + '/' + cartId).respond(200, { currency: "USD" });

            cartSvc.refreshCartAfterLogin(custId);
            mockBackend.flush();
        });
    });

    describe('refreshCartAfterLogin() - customer doesn\'t have cart', function () {

        var custId = 'abc';

        it('should merge the cart if there was an anonymous cart with items', function () {
            var custCartId = '567';
            // initialize to anonymous car with items
            mockBackend.expectGET(cartUrl).respond(200, {
                "currency": "USD",
                "items": [
                    {
                        "product": {
                            "id": prodId
                        },
                        "price": {
                            "currency": "USD",
                            "effectiveAmount": 5.00
                        },
                        "id": itemId,
                        "quantity": 2.0
                    }
                ],
                "id": cartId
            });
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(123)').respond(500, {});
            cartSvc.getCart();
            mockBackend.flush();

            // no cart for user
            mockBackend.expectGET(cartUrl + '?customerId=' + custId).respond(404, {});
            // create cart for user
            mockBackend.expectPOST(cartUrl).respond(201, { cartId: custCartId });
            // merge anonymous cart into current cart
            mockBackend.expectPOST(cartUrl + '/' + custCartId + '/merge', { "carts": [cartId] }).respond(200, {});
            // refresh cart after merge:
            mockBackend.expectGET(cartUrl + '/' + custCartId).respond(200, { currency: 'USD' });
            cartSvc.refreshCartAfterLogin(custId);
            mockBackend.flush();
        });
    });


    describe('getCart() for anonymous user', function () {
        it('should GET cart and retrieve product info', function () {
            var successCallback = jasmine.createSpy('success');
            var failureCallback = jasmine.createSpy('failure');
            mockBackend.expectGET(cartUrl).respond(200,
                {
                    "currency": "USD",
                    "subTotalPrice": {
                        "currency": "USD",
                        "amount": 10.00
                    },
                    "totalUnitsCount": 1.0,
                    "customerId": "39328def-2081-3f74-4004-6f35e7ee022f",
                    "items": [
                        {
                            "product": {
                                "sku": "sku1",
                                "inStock": true,
                                "description": "desc",
                                "id": prodId,
                                "name": "Electric Guitar"
                            },
                            "price": {
                                "currency": "USD",
                                "effectiveAmount": 5.00
                            },
                            "id": itemId,
                            "quantity": 2.0
                        }
                    ],
                    "totalPrice": {
                        "currency": "USD",
                        "amount": 13.24
                    },
                    "id": cartId,
                    "shippingCost": {
                        "currency": "USD",
                        "amount": 3.24
                    }
                });
            mockBackend.expectGET(productUrl + '?expand=media&q=id:(123)').respond(200, [{ id: prodId, images: ['myurl'] }]);
            var promise = cartSvc.getCart();
            promise.then(successCallback, failureCallback);
            mockBackend.flush();

            expect(successCallback).toHaveBeenCalled();
            expect(failureCallback).not.toHaveBeenCalled();

        });

        it('should GET cart and not retrieve product info if no line items', function () {
            var cart = null;

            mockBackend.expectGET(cartUrl).respond(200,
                {
                    "currency": "USD",
                    "subTotalPrice": {
                        "currency": "USD",
                        "amount": 10.00
                    },
                    "totalUnitsCount": 1.0,
                    "customerId": "39328def-2081-3f74-4004-6f35e7ee022f",
                    "totalPrice": {
                        "currency": "USD",
                        "amount": 13.24
                    },
                    "id": cartId,
                    "shippingCost": {
                        "currency": "USD",
                        "amount": 3.24
                    }
                });

            var promise = cartSvc.getCart();
            promise.then(function (result) {
                cart = result;
            });
            mockBackend.flush();
            expect(cart).toBeTruthy();
            expect(cart.totalPrice.amount).toEqualData(13.24);
        });

        it('should set cart error if GET results in non-404 error', function () {
            var cart = null;
            mockBackend.expectGET(cartUrl).respond(500, {});
            var promise = cartSvc.getCart();
            promise.then(function (result) { cart = result });
            mockBackend.flush();
            expect(cart).toBeTruthy();
            expect(cart.error).toBeTruthy();
        });

        it('should not set cart error if GET results in 404', function () {
            var cart = null;
            mockBackend.expectGET(cartUrl).respond(404, {});
            var promise = cartSvc.getCart();
            promise.then(function (result) { cart = result });
            mockBackend.flush();
            expect(cart).toBeTruthy();
            expect(cart.error).toBeFalsy();
        });
    });

});