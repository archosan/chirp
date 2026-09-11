

import { describe, expect, it, vi } from "vitest";
import { db, schema } from "../db";
import { createTestFollow, createTestLike, createTestPost, createTestUser, countQueries } from "../../tests/helpers";
import { getHomeFeed } from "./feed.service";
import { generateId } from "./utils";

const { comments } = schema;

describe("FeedService", () => {

    it("loads 10 home feed posts without per-post metadata", async () => {
        const viewer = await createTestUser();
	    const author = await createTestUser();

        await createTestFollow(viewer.id, author.id);

	    const postIds: string[] = [];

        for (let i = 0; i < 10; i++) {
            const postId = await createTestPost(author.id, `Post content ${i}`);
            postIds.push(postId);
            
            await createTestLike(viewer.id, postId);
            await db.insert(comments).values({
                id: generateId(),
                content: `Comment content ${i}`,
                postId,
                authorId: viewer.id,
            });

        }

        const counter = countQueries();

        const posts = await getHomeFeed(viewer.id, { limit: 10 });

        counter.restore();

        expect(posts).toHaveLength(10);
	    expect(posts[0].likeCount).toBe(1);
	    expect(posts[0].commentCount).toBe(1);
	    expect(posts[0].isLiked).toBe(true);

	    expect(counter.count).toBeLessThanOrEqual(5);
    });

});

