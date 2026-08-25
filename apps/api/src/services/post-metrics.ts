import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "../db";

const { likes, comments } = schema;

export interface PostMetrics {
	likeCount: number;
	commentCount: number;
	isLiked: boolean;
}

export async function getPostMetrics(
	postIds: string[],
	userId?: string,
): Promise<Map<string, PostMetrics>> {
	const metrics = new Map<string, PostMetrics>(
		postIds.map((postId) => [postId, { likeCount: 0, commentCount: 0, isLiked: false }]),
	);

	if (postIds.length === 0) {
		return metrics;
	}

	const likeCounts = await db
		.select({
			postId: likes.postId,
			count: sql<number>`count(*)`,
		})
		.from(likes)
		.where(inArray(likes.postId, postIds))
		.groupBy(likes.postId);

	for (const row of likeCounts) {
		const postMetric = row.postId ? metrics.get(row.postId) : undefined;
		if (postMetric) {
			postMetric.likeCount = row.count;
		}
	}

	const commentCounts = await db
		.select({
			postId: comments.postId,
			count: sql<number>`count(*)`,
		})
		.from(comments)
		.where(inArray(comments.postId, postIds))
		.groupBy(comments.postId);

	for (const row of commentCounts) {
		const postMetric = metrics.get(row.postId);
		if (postMetric) {
			postMetric.commentCount = row.count;
		}
	}

	if (userId) {
		const likedPosts = await db
			.select({ postId: likes.postId })
			.from(likes)
			.where(and(eq(likes.userId, userId), inArray(likes.postId, postIds)));

		for (const row of likedPosts) {
			const postMetric = row.postId ? metrics.get(row.postId) : undefined;
			if (postMetric) {
				postMetric.isLiked = true;
			}
		}
	}

	return metrics;
}
