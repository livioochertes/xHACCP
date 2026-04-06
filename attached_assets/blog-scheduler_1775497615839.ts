import cron from 'node-cron';
import { generateWeeklyBlogPost } from './ai-blog-generator';

export function startBlogScheduler() {
  // Schedule weekly blog post generation
  // Runs every Monday at 9:00 AM
  const scheduledTask = cron.schedule('0 9 * * MON', async () => {
    console.log('Starting weekly blog post generation...');
    try {
      const postId = await generateWeeklyBlogPost();
      console.log(`✅ Weekly blog post generated successfully! Post ID: ${postId}`);
    } catch (error) {
      console.error('❌ Failed to generate weekly blog post:', error);
    }
  }, {
    scheduled: false,
    timezone: "Europe/Bucharest" // Romania timezone
  });

  // Start the scheduler
  scheduledTask.start();
  console.log('📅 Blog scheduler started - Weekly posts will be generated every Monday at 9:00 AM (Bucharest time)');
  
  return scheduledTask;
}

export function stopBlogScheduler(task: cron.ScheduledTask) {
  task.stop();
  console.log('📅 Blog scheduler stopped');
}

// Optional: Generate a blog post immediately for testing
export async function generateTestBlogPost() {
  console.log('🧪 Generating test blog post...');
  try {
    const postId = await generateWeeklyBlogPost();
    console.log(`✅ Test blog post generated successfully! Post ID: ${postId}`);
    return postId;
  } catch (error) {
    console.error('❌ Failed to generate test blog post:', error);
    throw error;
  }
}