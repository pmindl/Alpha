Write-Host "Syncing invoice-downloader..."
git fetch origin-id main
git rm -r -f apps/invoice-downloader
git commit -m "Remove old apps/invoice-downloader"
git subtree add --prefix=apps/invoice-downloader origin-id main --squash

Write-Host "Syncing invoice-processor..."
git fetch origin-ip main
git rm -r -f apps/invoice-processor
git commit -m "Remove old apps/invoice-processor"
git subtree add --prefix=apps/invoice-processor origin-ip main --squash

Write-Host "Syncing customer-responder..."
git fetch origin-cr main
git rm -r -f apps/customer-responder
git commit -m "Remove old apps/customer-responder"
git subtree add --prefix=apps/customer-responder origin-cr main --squash

Write-Host "Syncing gmail-labeler..."
git fetch origin-gl main
git rm -r -f apps/gmail-labeler
git commit -m "Remove old apps/gmail-labeler"
git subtree add --prefix=apps/gmail-labeler origin-gl main --squash
