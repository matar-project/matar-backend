import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountStatus,
  VerificationDocumentStatus,
} from '../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { validateVerificationReport } from '../auth/verification-report-upload.config';

@Injectable()
export class VerificationsService {
  private readonly logger = new Logger(VerificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  pending() {
    return this.prisma.verificationDocument.findMany({
      where: {
        status: VerificationDocumentStatus.PENDING,
        user: {
          emailVerified: true,
          status: AccountStatus.PENDING_ADMIN_REVIEW,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            country: true,
            city: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getReport(documentId: number) {
    const document = await this.prisma.verificationDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) throw new NotFoundException('التقرير غير موجود');
    return { path: document.filePath, originalName: document.originalName };
  }

  async approve(documentId: number, adminId: number) {
    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.verificationDocument.findUnique({
        where: { id: documentId },
        include: { user: true },
      });
      if (!document) throw new NotFoundException('التقرير غير موجود');
      if (document.status !== VerificationDocumentStatus.PENDING) {
        throw new BadRequestException('تمت مراجعة هذا التقرير مسبقاً');
      }
      await tx.verificationDocument.update({
        where: { id: documentId },
        data: {
          status: VerificationDocumentStatus.APPROVED,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
          rejectionReason: null,
        },
      });
      await tx.user.update({
        where: { id: document.userId },
        data: { status: AccountStatus.ACTIVE },
      });
      return document.user;
    });

    let emailSent = true;
    try {
      await this.mail.sendApprovalEmail(result.email, result.name);
    } catch (error) {
      emailSent = false;
      this.logger.error(`Approval email failed for userId=${result.id}`, error);
    }
    return {
      message: emailSent
        ? 'تم قبول الحساب وإرسال إشعار بالبريد الإلكتروني'
        : 'تم قبول الحساب، لكن تعذر إرسال إشعار البريد الإلكتروني',
      emailSent,
    };
  }

  async reject(documentId: number, adminId: number, reason: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const document = await tx.verificationDocument.findUnique({
        where: { id: documentId },
        include: { user: true },
      });
      if (!document) throw new NotFoundException('التقرير غير موجود');
      if (document.status !== VerificationDocumentStatus.PENDING) {
        throw new BadRequestException('تمت مراجعة هذا التقرير مسبقاً');
      }
      await tx.verificationDocument.update({
        where: { id: documentId },
        data: {
          status: VerificationDocumentStatus.REJECTED,
          rejectionReason: reason,
          reviewedByAdminId: adminId,
          reviewedAt: new Date(),
        },
      });
      await tx.user.update({
        where: { id: document.userId },
        data: { status: AccountStatus.REJECTED },
      });
      return document.user;
    });

    let emailSent = true;
    try {
      await this.mail.sendRejectionEmail(result.email, result.name, reason);
    } catch (error) {
      emailSent = false;
      this.logger.error(`Rejection email failed for userId=${result.id}`, error);
    }
    return {
      message: emailSent
        ? 'تم رفض التقرير وإرسال إشعار بالبريد الإلكتروني'
        : 'تم رفض التقرير، لكن تعذر إرسال إشعار البريد الإلكتروني',
      emailSent,
    };
  }

  async reupload(userId: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('التقرير الصحي مطلوب');
    await validateVerificationReport(file);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (
      !user ||
      user.role.name !== 'visually_impired' ||
      user.status !== AccountStatus.REJECTED
    ) {
      throw new BadRequestException('لا يمكن رفع تقرير جديد لهذا الحساب');
    }
    await this.prisma.$transaction([
      this.prisma.verificationDocument.create({
        data: {
          userId,
          filePath: file.path,
          fileKey: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: AccountStatus.PENDING_ADMIN_REVIEW },
      }),
    ]);
    return { status: AccountStatus.PENDING_ADMIN_REVIEW };
  }
}
