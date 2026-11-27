[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [uri]$BaseUrl,

    [System.Security.SecureString]$FeedToken,

    [switch]$AssertBaseline
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $BaseUrl.IsAbsoluteUri -or $BaseUrl.Scheme -ne 'https' -or
    $BaseUrl.AbsolutePath -ne '/' -or $BaseUrl.UserInfo -or $BaseUrl.Query -or $BaseUrl.Fragment) {
    throw 'Use the HTTPS Worker origin without a path, query, or user credentials.'
}

function Confirm-Check([bool]$Passed, [string]$Message) {
    if (-not $Passed) { throw $Message }
}

if ($null -eq $FeedToken) { $FeedToken = Read-Host 'Existing FEED_TOKEN' -AsSecureString }
if ($FeedToken.Length -eq 0) { throw 'FEED_TOKEN is empty.' }

$origin = $BaseUrl.GetLeftPart([UriPartial]::Authority)
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($FeedToken)
try {
    $headers = @{ Authorization = 'Bearer ' + [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

function Get-WorkerJson([string]$Path) {
    Invoke-RestMethod -Uri ($origin + $Path) -Headers $headers -Method Get -MaximumRedirection 0 -TimeoutSec 30
}

try {
    $api = '/api/admin/v3/'
    $health = Get-WorkerJson '/health'
    Confirm-Check ($health.ok -and $health.version -eq '3.0.4' -and $health.features.intelligenceQuality) 'Unexpected Worker version or missing intelligence feature.'
    Confirm-Check (-not $health.translationEnabled -and $health.contentLanguage -eq 'en-original') 'Worker language settings changed.'

    $summary = Get-WorkerJson ($api + 'summary')
    $counts = $summary.intelligence
    Confirm-Check ($summary.activeBrands -eq 41) 'Expected 41 active brands.'
    $monitor = Get-WorkerJson ($api + 'source-monitor')
    $eligible = @($monitor.sources | Where-Object { $_.collectorEligible })
    $expected = @('Gearnews','Mix Online','AVNation','Church Production','Production Expert',
        'Church Sound Podcast','Signal To Noise (Pro Sound Web Podcast)')
    $difference = Compare-Object -ReferenceObject ($expected | Sort-Object) -DifferenceObject @($eligible.source_name | Sort-Object)
    Confirm-Check (-not $difference) 'The seven eligible collection sources do not match.'
    $podcasts = @($eligible | Where-Object { $_.feed_content_mode -eq 'podcast_metadata' })
    Confirm-Check ($podcasts.Count -eq 2 -and @($podcasts | Where-Object { $_.max_items_per_run -ne 20 }).Count -eq 0) 'Unexpected podcast settings.'

    Confirm-Check ($counts.podcastEpisodes -ge 40 -and $counts.brandMentions -ge 29 -and
        $counts.industryDiscussions -ge 5 -and $counts.reclassifiedPodcastRecords -ge 35 -and
        $counts.legacyNonPodcastEvents -ge 7) 'One or more historical counts are below baseline.'
    if ($AssertBaseline) {
        Confirm-Check ($counts.podcastEpisodes -eq 40 -and $counts.brandMentions -eq 29 -and
            $counts.industryDiscussions -eq 5 -and $counts.pendingReviews -eq 1 -and
            $counts.actionableEvents -eq 0 -and $counts.legacyNonPodcastEvents -eq 7 -and
            $counts.reclassifiedPodcastRecords -eq 35) 'Counts differ from the pre-collection, pre-review baseline.'
    }

    $episodes = Get-WorkerJson ($api + 'podcast-episodes?limit=200')
    Confirm-Check (@($episodes.episodes).Count -ge 40) 'Episode list is incomplete.'
    foreach ($episode in $episodes.episodes) {
        Confirm-Check ($episode.source_url -match '^https://') 'An episode is missing its original HTTPS link.'
    }

    $id324 = [uri]::EscapeDataString('legacy:e669cde2-5ce6-4a09-b55d-a71813f2c558')
    $states = if ($AssertBaseline) { @('pending') } else { @('pending','dismissed','approved') }
    $soundBase = @(foreach ($status in $states) {
        $page = Get-WorkerJson ($api + "review-queue?id=$id324&status=$status")
        $page.reviews | Where-Object { $_.id }
    })
    Confirm-Check ($soundBase.Count -eq 1) 'Episode 324 review history was not found.'
    Confirm-Check ($soundBase[0].original_event_type -eq 'PRODUCT_UPGRADE' -and
        $soundBase[0].source_url -match '/19033615-324-') 'Episode 324 original evidence or link changed.'

    $legacy = Get-WorkerJson ($api + 'events?scope=legacy&limit=200')
    Confirm-Check (@($legacy.events).Count -ge 7) 'Legacy non-podcast event history is incomplete.'
    $events = Get-WorkerJson ($api + 'events?limit=200')
    foreach ($event in $events.events) {
        Confirm-Check ($event.intelligence_class -eq 'actionable' -and $event.event_subject -and
            $event.evidence_text -and $event.evidence_field -and $event.evidence_url -match '^https://') 'An actionable event lacks explicit evidence.'
    }

    $feed = Get-WorkerJson '/api/briefing.json'
    Confirm-Check ($feed.minRelevanceScore -eq 35 -and -not $feed.translationEnabled -and
        $feed.contentLanguage -eq 'en-original') 'Briefing defaults differ from 35 / English original.'
    $previous = 101
    foreach ($item in $feed.items) {
        Confirm-Check ($item.relevanceScore -ge 35 -and $item.relevanceScore -le $previous) 'Briefing relevance or score order is incorrect.'
        $previous = $item.relevanceScore
    }

    [PSCustomObject]@{
        Version = $health.version
        CollectionSources = $eligible.Count
        ActiveBrands = $summary.activeBrands
        PodcastEpisodes = $counts.podcastEpisodes
        BrandMentions = $counts.brandMentions
        IndustryDiscussions = $counts.industryDiscussions
        PendingReviews = $counts.pendingReviews
        Episode324Status = $soundBase[0].review_status
        ActionableEvents = $counts.actionableEvents
        LegacyNonPodcastEvents = $counts.legacyNonPodcastEvents
        BriefingMinRelevanceScore = $feed.minRelevanceScore
    }
} finally {
    $headers.Clear()
}
