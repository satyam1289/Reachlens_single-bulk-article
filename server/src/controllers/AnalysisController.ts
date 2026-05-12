import type { Request, Response } from 'express';
import { SmartScraper } from '../services/SmartScraper.js';
import { SocialScraperService } from '../services/SocialScraperService.js';
import { ReachEstimator } from '../services/ReachEstimator.js';
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
// import db from '../db.js'; // Removed for stateless deployment


const smartScraper = new SmartScraper();
const socialScraper = new SocialScraperService();

export const performAnalysis = async (url: string, version: string = 'v9') => {
    // Validate version
    if (!['v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8', 'v9'].includes(version)) version = 'v9';

    const [smartResult, redditResult] = await Promise.all([
        smartScraper.scrapeUrl(url),
        socialScraper.scrapeReddit(url)
    ]);

    const googleCount = smartResult.totalMentions || 0;
    const redditCount = redditResult.count || 0;
    const totalMentions = googleCount + redditCount;

    let estimatedReach = 0;
    let confidenceScore = 0;
    let sentimentScore = 0;

    // --- Versioned Logic ---
    let uv = 0;
    let upv = 0;

    if (smartResult.source === 'Estimator') {
        // CORE 2: The "Estimator" Path
        const estimate = ReachEstimator.estimate(url, smartResult.title || '', version, smartResult);
        estimatedReach = estimate.reach;
        confidenceScore = estimate.confidence;
        sentimentScore = estimate.sentimentScore;
        // @ts-ignore
        if (estimate.uv) uv = estimate.uv;
        // @ts-ignore
        if (estimate.upv) upv = estimate.upv;

    } else {
        // CORE 1: The "Stealth" Path (Real Data)
        confidenceScore = 100;

        // 1. Domain Authority Weight (Common)
        let avgDomainWeight = 1;
        if (smartResult.domains && smartResult.domains.length > 0) {
            const weights = smartResult.domains.map(d => ReachEstimator.getDomainWeight(d));
            const totalWeight = weights.reduce((a, b) => a + b, 0);
            avgDomainWeight = totalWeight / weights.length;
        }

        // 2. Base Value & Positional Logic
        let baseVal = 500; // v2 default
        let positionalWeight = 1.0;
        if (version === 'v4') baseVal = 425;
        if (version === 'v5') baseVal = 380;
        if (version === 'v6') baseVal = 350; // v6 default (Grounded Base simulation)

        if (version !== 'v2') {
            // v3+ uses Heat Map
            positionalWeight = smartResult.prominenceScore || 1.0;
        }

        // 3. Indexing Bonus
        let indexingBonus = 5000;
        if (smartResult.domains.some(d => d.includes('news') || d.includes('times') || d.includes('post'))) {
            indexingBonus = 10000;
        }

        // v4/v5/v6 GEO Boost
        if ((version === 'v4' || version === 'v5' || version === 'v6') &&
            smartResult.domains.some(d => d.includes('perplexity') || d.includes('gemini') || d.includes('chatgpt'))) {
            indexingBonus += 25000;
        }

        // Stealth Formula
        estimatedReach = ((googleCount + redditCount) * baseVal * avgDomainWeight * positionalWeight) + indexingBonus;

        // Sentiment (v4+) - Weighted Analysis
        if ((version === 'v4' || version === 'v5' || version === 'v6')) {
            sentimentScore = ReachEstimator.analyzeSentiment(
                smartResult.title || '',
                smartResult.metaDescription,
                smartResult.snippet
            );
        }
    }

    // --- Universal Modifiers (Versioned) ---

    // v9.0: Content Provenance Graph (CPG) & 5-Tier Classification
    let provenanceTier = 'T0';
    if (version === 'v9') {
        const topDomains = smartResult.domains.slice(0, 5);
        const targetDomain = new URL(url).hostname.replace('www.', '');
        const isTargetInTop3 = topDomains.slice(0, 3).some(d => targetDomain.includes(d));

        if (isTargetInTop3) {
            provenanceTier = 'T0'; // Origin
        } else if (topDomains.some(d => d.includes('msn.com') || d.includes('yahoo.com') || d.includes('apnews.com') || d.includes('reuters.com'))) {
            provenanceTier = 'T1'; // Licensed Syndication
        } else if (topDomains.length > 0) {
            provenanceTier = 'T2'; // Indexed Reprint
        } else {
            provenanceTier = 'T3'; // Probable Scraper/Thin
        }
    }

    // v8.0/v9.0 integration for reprint flag
    const isReprint = provenanceTier !== 'T0';

    const modifiers = ReachEstimator.applyModifiers(estimatedReach, version, new Date(), smartResult.domains, {
        ...smartResult,
        isReprint,
        provenanceTier,
        url
    });
    estimatedReach = modifiers.finalReach;
    const velocity = modifiers.velocity;
    const agenticStatus = modifiers.agenticStatus;
    const deviation = (modifiers as any).deviation;
    const uvr = (modifiers as any).uv; // v9 UVR (Unique Verified Reach)

    return {
        url,
        totalMentions,
        googleCount,
        redditCount,
        estimatedReach,
        confidenceScore,
        sentimentScore,
        velocity,
        agenticStatus,
        version,
        provenanceTier,
        isReprint,
        deviation,
        uvr: uvr || uv,
        smartResult,
        redditResult,
        modifiers
    };
};

export const analyzeUrl = async (req: Request, res: Response) => {
    let { url, version } = req.body;

    if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
    }

    try {
        const result = await performAnalysis(url, version);

        res.json({
            id: Math.floor(Math.random() * 1000000), // Random ID for stateless response

            url: result.url,
            totalMentions: result.totalMentions,
            estimatedReach: result.estimatedReach,
            confidenceScore: result.confidenceScore,
            sentimentScore: result.sentimentScore,
            velocity: result.velocity,
            agenticStatus: result.agenticStatus,
            version: result.version,
            breakdown: {
                google: { ...result.smartResult, totalMentions: result.googleCount },
                reddit: result.redditResult,
                meta: {
                    agenticStatus: result.agenticStatus,
                    logic: getVersionName(result.version),
                    uv: result.uvr,
                    upv: (result.modifiers as any).upv || undefined,
                    socialProof: result.smartResult.socialProof,
                    deviation: result.deviation,
                    isReprint: result.isReprint,
                    provenanceTier: result.provenanceTier,
                    entropy: (result.modifiers as any).entropy || undefined
                }
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Analysis failed' });
    }
};


export const analyzeBulk = async (req: Request, res: Response) => {
    const file = (req as any).file;
    if (!file) {
        res.status(400).json({ error: 'Excel file is required' });
        return;
    }

    const { version } = req.body;

    try {
        const workbook = XLSX.read(file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            res.status(400).json({ error: 'Excel file is empty' });
            return;
        }
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
            res.status(400).json({ error: 'Selected sheet not found' });
            return;
        }
        const data: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Extract URLs from first column, handle headers, trim, and validate
        const urls = data
            .map(row => (Array.isArray(row) && row.length > 0) ? row[0] : null)
            .filter(val => val !== undefined && val !== null && val !== '')
            .map(val => String(val).trim())
            .filter(val => val.toLowerCase().startsWith('http'));

        if (urls.length === 0) {
            res.status(400).json({ error: 'No valid URLs found in the first column of the Excel file' });
            return;
        }

        // Process URLs in parallel to avoid Vercel timeouts
        const analysisPromises = urls.map(async (url) => {
            try {
                const result = await performAnalysis(url, version);
                return {
                    'URL': result.url,
                    'Total Mentions': result.totalMentions,
                    'Agentic Rank': result.agenticStatus || "None",
                    'Estimated Reach': Math.round(result.estimatedReach).toLocaleString(),
                    'Truth Confidence': `${result.confidenceScore}%`,
                    'Google Mentions': result.googleCount,
                    'Reddit Mentions': result.redditCount,
                    'UVR (Unique Reach)': Math.round(result.uvr).toLocaleString(),
                    'Social Diffusion': (result.modifiers as any).entropy ? (result.modifiers as any).entropy.toFixed(2) : "0.00",
                    'Sentiment Impact': result.sentimentScore > 1 ? "Positive" : result.sentimentScore < -1 ? "Controversial" : "Neutral",
                    'Growth Velocity': result.velocity
                };
            } catch (err) {
                console.error(`Failed to analyze ${url}:`, err);
                return {
                    'URL': url,
                    'Total Mentions': 'N/A',
                    'Agentic Rank': 'N/A',
                    'Estimated Reach': 'N/A',
                    'Truth Confidence': 'N/A',
                    'Google Mentions': 'N/A',
                    'Reddit Mentions': 'N/A',
                    'UVR (Unique Reach)': 'N/A',
                    'Social Diffusion': 'N/A',
                    'Sentiment Impact': 'N/A',
                    'Growth Velocity': 'N/A'
                };
            }
        });

        const results = await Promise.all(analysisPromises);

        // Create new workbook with results
        const newWs = XLSX.utils.json_to_sheet(results);
        const newWb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWb, newWs, 'Analysis Results');

        // Generate buffer
        const outBuffer = XLSX.write(newWb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=reachlens_analysis.xlsx');
        res.send(outBuffer);

    } catch (error) {
        console.error('Bulk analysis error:', error);
        res.status(500).json({ error: 'Bulk analysis failed' });
    }
};

function getVersionName(v: string) {
    if (v === 'v2') return 'Dual-Core (Verified + Drift)';
    if (v === 'v3') return 'Contextual (Heat Map + Industry)';
    if (v === 'v4') return 'Causal (Sentiment + GEO Detection)';
    if (v === 'v5') return 'Behavioral (Agentic + SISI)';
    return 'Integrated (Grounded + Stickiness)';
}

