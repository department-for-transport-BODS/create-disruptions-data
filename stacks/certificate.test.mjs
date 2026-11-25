import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { Distribution } from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import { DnsValidatedCertificate } from "sst/constructs/cdk/dns-validated-certificate.js";

test("SST DNS-validated certificates synthesize with the installed CDK CloudFront distribution", (t) => {
    const outdir = mkdtempSync(join(tmpdir(), "cdd-certificate-test-"));
    t.after(() => rmSync(outdir, { recursive: true, force: true }));

    const app = new App({ outdir });
    const stack = new Stack(app, "CertificateCompatibility", {
        env: { account: "123456789012", region: "eu-west-2" },
    });
    const hostedZone = HostedZone.fromHostedZoneAttributes(stack, "Zone", {
        hostedZoneId: "Z123456789",
        zoneName: "example.com",
    });
    const certificate = new DnsValidatedCertificate(stack, "Certificate", {
        domainName: "test.example.com",
        hostedZone,
        region: "us-east-1",
    });

    new Distribution(stack, "Distribution", {
        domainNames: ["test.example.com"],
        certificate,
        defaultBehavior: { origin: new HttpOrigin("origin.example.com") },
    });

    app.synth();
    Template.fromStack(stack).hasResourceProperties("AWS::CloudFront::Distribution", {
        DistributionConfig: {
            Aliases: ["test.example.com"],
            ViewerCertificate: {
                AcmCertificateArn: stack.resolve(certificate.certificateArn),
            },
        },
    });
});
