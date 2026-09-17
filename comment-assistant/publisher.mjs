/**
 * Future publishing boundary. Keeping this contract separate ensures the MVP
 * cannot accidentally turn generation into an automatic YouTube write.
 */
export class YouTubeCommentPublisher {
  async authorize() {
    throw new Error("YOUTUBE_OAUTH_NOT_IMPLEMENTED");
  }

  async publish() {
    throw new Error("YOUTUBE_COMMENT_PUBLISHING_NOT_IMPLEMENTED");
  }
}
