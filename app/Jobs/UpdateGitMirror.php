<?php

namespace REBELinBLUE\Deployer\Jobs;

use Illuminate\Contracts\Bus\SelfHandling;
use Illuminate\Foundation\Bus\DispatchesJobs;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use REBELinBLUE\Deployer\Jobs\Job;
use REBELinBLUE\Deployer\Jobs\UpdateGitReferences;
use REBELinBLUE\Deployer\Project;
use Symfony\Component\Process\Process;

class UpdateGitMirror extends Job implements SelfHandling
{
    use InteractsWithQueue, SerializesModels, DispatchesJobs;

    private $project;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct(Project $project)
    {
        $this->project = $project;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        // Use the repository rather than the project ID, so if a single
        // repo is used in multiple projects it is not duplicated
        $mirrorDir = $this->project->mirrorPath();

        $private_key = tempnam(storage_path('app/'), 'sshkey');
        file_put_contents($private_key, $this->project->private_key);

        $wrapper = tempnam(storage_path('app/'), 'gitssh');
        file_put_contents($wrapper, $this->gitWrapperScript($private_key));

        $cmd = <<< CMD
chmod +x "{$wrapper}" && \
export GIT_SSH="{$wrapper}" && \
( [ ! -d {$mirrorDir} ] && git clone --mirror %s {$mirrorDir} ) && \
cd {$mirrorDir} &&
git fetch --all --prune
exit 0 # FIXME: Not sure why I need this, otherwise it fails
CMD;

        $process = new Process(sprintf($cmd, $this->project->repository));
        $process->setTimeout(null);
        $process->run();

        unlink($wrapper);
        unlink($private_key);

        if (!$process->isSuccessful()) {
            throw new \RuntimeException('Could not mirror repository - ' . $process->getErrorOutput());
        }

        $this->dispatch(new UpdateGitReferences($this->project));
    }

    /**
     * Generates the content of a git bash script.
     *
     * @param  string $key_file_path The path to the public key to use
     * @return string
     */
    private function gitWrapperScript($key_file_path)
    {
        return <<<OUT
#!/bin/sh
ssh -o CheckHostIP=no \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=no \
    -o PasswordAuthentication=no \
    -o IdentityFile={$key_file_path} $*
OUT;
    }
}
