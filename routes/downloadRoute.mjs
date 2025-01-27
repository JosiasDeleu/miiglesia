import { Router } from 'express';
import { dirname, join, normalize } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

router.get('/download', (req, res) => {
    try {
        const requestedFile = req.query.file;
        console.log('requestedFile:', requestedFile);
        
        if (!requestedFile) {
            return res.status(400).send('No file specified');
        }

        let filePath;
        const reportsDir = process.env.REPORTS_DIR;
        
        if (!reportsDir) {
            return res.status(500).send('Reports directory not configured');
        }

        // Remove any parent directory traversal attempts
        // const normalizedPath = normalize(requestedFile).replace(/^(\.\.(\/|\\|$))+/, '');
        const normalizedPath = requestedFile

        // Only allow access to files within REPORTS_DIR
        filePath = join(reportsDir, normalizedPath);
        console.log('filePath:', filePath);

        // Verify the file exists and is within REPORTS_DIR
        console.log('file exists in directory:', fs.existsSync(filePath))
        
        if (!fs.existsSync(filePath)) {
            console.log('File not found or access denied');
            return res.status(404).send('File not found or access denied');
        }

        console.log('Sending file:', filePath);
        // Send the file
        res.download(filePath, (err) => {
            if (err) {
                console.error('Download error:', err);
                if (!res.headersSent) {
                    res.status(500).send('Error downloading file');
                }
            }
        });

    } catch (error) {
        console.error('Download route error:', error);
        res.status(500).send('Internal server error');
    }
});

export const downloadRoute = router;
