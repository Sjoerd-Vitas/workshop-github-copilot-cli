import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

/** Column selection shared by all game queries (game plus joined category and publisher). */
const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

/** A flat row produced by {@link gameSelection}; joined columns are null when the relation is missing. */
type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

/** Maps a flat query row to a {@link Game} with nested category and publisher. */
function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

/** Base select for games with left joins on categories and publishers. */
function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Optional filters for {@link getGames}. Empty or missing lists mean "no filter". */
export interface GameFilters {
    /** Keep games in any of these categories. */
    categoryIds?: number[];
    /** Keep games from any of these publishers. */
    publisherIds?: number[];
}

/**
 * Games ordered by title, optionally filtered by category and/or publisher.
 * Ids within one list are OR-ed; the category and publisher filters are AND-ed.
 */
export async function getGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const conditions: SQL[] = [];
    if (filters.categoryIds && filters.categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, filters.categoryIds));
    }
    if (filters.publisherIds && filters.publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, filters.publisherIds));
    }
    const rows = await baseGamesQuery(db)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All games ordered by title. */
export async function getAllGames(db: Database): Promise<Game[]> {
    return getGames(db);
}

/** All categories ordered by name. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    return db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.name));
}

/** All publishers ordered by name. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    return db.select({ id: publishers.id, name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
}

/** All game ids ordered by title. */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
