/* eslint-disable @typescript-eslint/no-explicit-any */
import faker from 'faker';
import slugify from 'slugify';
import pMap from 'p-map';
import got from 'got';

import {dbManager} from 'app/lib/db-manager';
import {
    Brand,
    Order,
    Catalog,
    CatalogItem,
    GoodCategory,
    PetCategory,
    OrderPosition,
    Storage,
    User
} from '$db-entity/entities';
import {OrderStatus, OrderResolution} from '$db-entity/order';
import {DbTable} from '$db-entity/tables';

async function createBrand() {
    const name = faker.name.title() + Math.random();
    const {manager} = dbManager.getConnection().getRepository(Brand);

    const brand = manager.create(Brand, {
        code: slugify(name),
        displayName: name
    });

    await manager.save(brand);

    return manager.findOneOrFail(Brand, brand.id);
}

async function createPetCategory() {
    const name = faker.name.title() + Math.random();
    const {manager} = dbManager.getConnection().getRepository(PetCategory);

    const pet = manager.create(PetCategory, {
        code: slugify(name),
        displayName: name
    });

    await manager.save(pet);

    return manager.findOneOrFail(PetCategory, pet.id);
}

async function createGoodCategory() {
    const name = faker.name.title() + Math.random();
    const {manager} = dbManager.getConnection().getRepository(GoodCategory);

    const good = manager.create(GoodCategory, {
        code: slugify(name),
        displayName: name
    });

    await manager.save(good);

    return manager.findOneOrFail(GoodCategory, good.id);
}

interface CreateCatalogParams {
    goodCategoryId: number;
    petCategoryId: number;
    brandId: number;
}

async function createCatalog(params: CreateCatalogParams) {
    const {manager} = dbManager.getConnection().getRepository(Catalog);

    const catalog = manager.create(Catalog, {
        goodCategoryId: params.goodCategoryId,
        petCategoryId: params.petCategoryId,
        brandId: params.brandId,
        displayName: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        rating: faker.random.float() % 5,
        manufacturerCountry: faker.address.country()
    });

    await manager.save(catalog);

    return manager.findOneOrFail(Catalog, catalog.id);
}

interface CreateCatalogItemParams {
    catalogId: number;
}

async function createCatalogItem(params: CreateCatalogItemParams) {
    const {manager} = dbManager.getConnection().getRepository(CatalogItem);

    const catalogItem = manager.create(CatalogItem, {
        catalogId: params.catalogId,
        weightKg: faker.random.float() % 30,
        photoUrls: [faker.image.image()]
    });

    await manager.save(catalogItem);

    return manager.findOneOrFail(CatalogItem, catalogItem.id);
}

interface CreateOrderParams {
    status?: OrderStatus;
    resolution?: OrderResolution;
}

async function createOrder(params: CreateOrderParams = {}) {
    const {manager} = dbManager.getConnection().getRepository(Order);

    const order = manager.create(Order, {
        data: {},
        clientPhone: faker.phone.phoneNumber(),
        deliveryAddress: faker.address.streetAddress(),
        deliveryComment: faker.lorem.text(),
        deliveryDate: faker.date.future(),
        status: params.status || OrderStatus.CREATED,
        resolution: params.resolution
    });

    await manager.save(order);

    return manager.findOneOrFail(Order, order.id);
}

interface CreateStorageParams {
    catalogItemId: number;
}

async function createStorage(params: CreateStorageParams) {
    const connection = dbManager.getConnection();
    const {manager} = connection.getRepository(Storage);

    const storage = manager.create(Storage, {
        catalogItemId: params.catalogItemId,
        cost: faker.random.float(),
        quantity: faker.random.number()
    });

    await manager.save(storage);

    return manager.findOneOrFail(Storage, storage.id);
}

interface CreateOrderPositionParams {
    orderId: number;
}

async function createOrderPosition(params: CreateOrderPositionParams) {
    const connection = dbManager.getConnection();

    const brand = await TestFactory.createBrand();
    const pet = await TestFactory.createPetCategory();
    const good = await TestFactory.createGoodCategory();

    const catalog = await TestFactory.createCatalog({
        goodCategoryId: good.id,
        petCategoryId: pet.id,
        brandId: brand.id
    });

    const catalogItems = await Promise.all([
        TestFactory.createCatalogItem({catalogId: catalog.id}),
        TestFactory.createCatalogItem({catalogId: catalog.id})
    ]);

    const storageItems = await Promise.all(
        catalogItems.map((catalogItem) => TestFactory.createStorage({catalogItemId: catalogItem.id}))
    );

    const orderPositions = await pMap(catalogItems, async (catalogItem, i) => {
        const {manager} = connection.getRepository(OrderPosition);

        const orderPosition = manager.create(OrderPosition, {
            orderId: params.orderId,
            cost: faker.random.float(),
            quantity: faker.random.number(),
            data: {
                storage: {
                    id: storageItems[i].id,
                    cost: storageItems[i].cost,
                    quantity: storageItems[i].quantity,
                    createdAt: storageItems[i].createdAt.toISOString(),
                    updatedAt: storageItems[i].updatedAt.toISOString()
                },
                catalog: {
                    id: catalog.id,
                    displayName: catalog.displayName,
                    description: catalog.description,
                    rating: catalog.rating,
                    manufacturerCountry: catalog.manufacturerCountry,
                    brand: {
                        code: brand.code,
                        name: brand.displayName
                    },
                    pet: {
                        code: pet.code,
                        name: pet.displayName
                    },
                    good: {
                        code: good.code,
                        name: good.displayName
                    },
                    createdAt: catalog.createdAt.toISOString(),
                    updatedAt: catalog.updatedAt.toISOString()
                },
                catalogItem: {
                    id: catalogItem.id,
                    publicId: catalogItem.publicId,
                    photoUrls: catalogItem.photoUrls,
                    weightKg: catalogItem.weightKg,
                    createdAt: catalogItem.createdAt.toISOString(),
                    updatedAt: catalogItem.updatedAt.toISOString()
                }
            }
        });

        await manager.save(orderPosition);

        return manager.findOneOrFail(OrderPosition, orderPosition.id);
    });

    return orderPositions;
}

interface CreateUserParams {
    lastSmsCodeAt?: Date;
}

async function createUser(params: CreateUserParams = {}) {
    const connection = dbManager.getConnection();
    const {manager} = connection.getRepository(User);

    const user = manager.create(User, {
        phone: String(faker.random.number()),
        lastSmsCode: faker.random.number(),
        lastSmsCodeAt: params.lastSmsCodeAt
    });

    await manager.save(user);

    return manager.findOneOrFail(User, user.id);
}

async function getAllUsers() {
    return dbManager.getConnection().createQueryBuilder().select(DbTable.USER).from(User, DbTable.USER).getMany();
}

async function getAllStorageItems() {
    return dbManager
        .getConnection()
        .createQueryBuilder()
        .select(DbTable.STORAGE)
        .from(Storage, DbTable.STORAGE)
        .getMany();
}

async function getAllOrders() {
    return dbManager.getConnection().createQueryBuilder().select(DbTable.ORDER).from(Order, DbTable.ORDER).getMany();
}

async function getCsrfToken(url: string) {
    const user = await TestFactory.createUser();

    const {headers} = await got.post<any>(`${url}/api/v1/sms/verify_code`, {
        responseType: 'json',
        throwHttpErrors: false,
        json: {
            phone: user.phone,
            code: user.lastSmsCode
        }
    });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = /csrf_token=(.+?);/gim.exec(headers['set-cookie']![0]) as string[];

    return result[1];
}

export const TestFactory = {
    createBrand,
    createPetCategory,
    createGoodCategory,
    createCatalog,
    createCatalogItem,
    createOrder,
    createOrderPosition,
    createStorage,
    createUser,
    getAllStorageItems,
    getAllOrders,
    getAllUsers,
    getCsrfToken
};
