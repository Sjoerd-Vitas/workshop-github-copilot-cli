import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGames,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        /** Ids of the seeded categories and publishers, keyed by name. */
        interface Fixture {
            categoryIds: Record<string, number>;
            publisherIds: Record<string, number>;
        }

        /** Seeds three categories, two publishers and four games (A-D) for the filter tests. */
        async function seedFilterFixture(): Promise<Fixture> {
            const cats = await db
                .insert(categories)
                .values([{ name: 'Strategy' }, { name: 'Puzzle' }, { name: 'Action' }])
                .returning({ id: categories.id, name: categories.name });
            const pubs = await db
                .insert(publishers)
                .values([{ name: 'Zeta Studios' }, { name: 'Alpha Games' }])
                .returning({ id: publishers.id, name: publishers.name });
            const c = Object.fromEntries(cats.map((x) => [x.name, x.id]));
            const p = Object.fromEntries(pubs.map((x) => [x.name, x.id]));
            await db.insert(games).values([
                { title: 'A', description: 'd', categoryId: c.Strategy, publisherId: p['Alpha Games'] },
                { title: 'B', description: 'd', categoryId: c.Puzzle, publisherId: p['Alpha Games'] },
                { title: 'C', description: 'd', categoryId: c.Strategy, publisherId: p['Zeta Studios'] },
                { title: 'D', description: 'd', categoryId: c.Action, publisherId: p['Zeta Studios'] },
            ]);
            return { categoryIds: c, publisherIds: p };
        }

        /** Extracts the titles from a list of games. */
        const titles = (list: { title: string }[]): string[] => list.map((g) => g.title);

        it('returns all games when no filters are given', async () => {
            await seedFilterFixture();
            expect(titles(await getGames(db))).toEqual(['A', 'B', 'C', 'D']);
            expect(titles(await getGames(db, { categoryIds: [], publisherIds: [] }))).toEqual(['A', 'B', 'C', 'D']);
        });

        it('filters by one or more categories', async () => {
            const f = await seedFilterFixture();
            expect(titles(await getGames(db, { categoryIds: [f.categoryIds.Strategy] }))).toEqual(['A', 'C']);
            expect(
                titles(await getGames(db, { categoryIds: [f.categoryIds.Puzzle, f.categoryIds.Action] })),
            ).toEqual(['B', 'D']);
        });

        it('filters by publisher', async () => {
            const f = await seedFilterFixture();
            expect(titles(await getGames(db, { publisherIds: [f.publisherIds['Zeta Studios']] }))).toEqual(['C', 'D']);
        });

        it('combines category and publisher filters', async () => {
            const f = await seedFilterFixture();
            const result = await getGames(db, {
                categoryIds: [f.categoryIds.Strategy],
                publisherIds: [f.publisherIds['Zeta Studios']],
            });
            expect(titles(result)).toEqual(['C']);
        });

        it('returns an empty list when nothing matches', async () => {
            const f = await seedFilterFixture();
            const result = await getGames(db, {
                categoryIds: [f.categoryIds.Puzzle],
                publisherIds: [f.publisherIds['Zeta Studios']],
            });
            expect(result).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            await seedFilterFixture();
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Action', 'Puzzle', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Alpha Games', 'Zeta Studios']);
        });
    });
});
