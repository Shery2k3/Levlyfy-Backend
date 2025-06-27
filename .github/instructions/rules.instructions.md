---
applyTo: '**/*.ts'
---
Coding standards, domain knowledge, and preferences that AI should follow.
Backend Requirement Summary:
The backend must support a secure, scalable system for processing and analyzing call recordings uploaded by users. After authentication and file upload (to S3) with call metadata stored in MongoDB, the backend should decrypt and transcribe audio files using OpenAI’s Whisper API. The resulting transcription must then be analyzed by a GPT-based service to extract insights, generate feedback, and support features like performance tracking, gamification, and manager insights. All processing must ensure data privacy, compliance, and seamless integration with CRM and other modules, supporting future scalability and cloud deployment.

Let me know what you have done so far, and I’ll help you with the next steps!