import { describe, expect, it, vi } from "vitest";
import { db, schema } from "../db";
import { countQueries, createTestLike, createTestPost, createTestUser } from "../../tests/helpers";
import { getBookmarkedPosts, toggleBookmark } from "./bookmarks.service";
import { generateId } from "./utils";

describe("BookmarkService", () => {
    it("loads 10 bookmarked posts without per-post queries", async () => {
        const user = await createTestUser();
        const author = await createTestUser();
        const { comments } = schema;

        for (let i = 0; i < 10; i++) {
            const postId = await createTestPost(author.id, `Bookmarked post ${i}`);

            await toggleBookmark(postId, user.id);
            await createTestLike(user.id, postId);

            await db.insert(comments).values({
                id: generateId(),
                postId,
                authorId: user.id,
                content: `Comment ${i}`,
            });
        }

        const counter = countQueries();

        const posts = await getBookmarkedPosts(user.id, user.id, 10, 0);

        counter.restore();

        expect(posts).toHaveLength(10);
        expect(posts[0].author).toBeDefined();
        expect(posts[0].likeCount).toBe(1);
        expect(posts[0].commentCount).toBe(1);
        expect(posts[0].isLiked).toBe(true);

        expect(counter.count).toBeLessThanOrEqual(4);
    });

})
